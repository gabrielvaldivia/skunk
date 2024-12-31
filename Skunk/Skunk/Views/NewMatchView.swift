import CloudKit
import CoreLocation
import SwiftUI

#if canImport(FirebaseAnalytics)
    import FirebaseAnalytics
#endif

extension Sequence {
    func uniqued<T: Hashable>(by keyPath: KeyPath<Element, T>) -> [Element] {
        var seen = Set<T>()
        return filter { seen.insert($0[keyPath: keyPath]).inserted }
    }
}

#if canImport(UIKit)
    struct NewMatchView: View {
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @EnvironmentObject private var authManager: AuthenticationManager
        @StateObject private var locationManager = LocationManager()

        let game: Game?
        let defaultPlayerIDs: [String]?
        let onMatchSaved: ((Match) -> Void)?

        @State private var selectedGame: Game?
        @State private var players: [Player?]
        @State private var scores: [Int?]
        @State private var currentRound = 0
        @State private var rounds: [[Int?]] = []
        @State private var showingAddGame = false
        @State private var showingAddPlayer = false
        @State private var showingError = false
        @State private var error: Error?
        @State private var isLoading = false

        private var canSave: Bool {
            if let game = selectedGame ?? self.game {
                let validPlayers = players.compactMap { $0 }
                let hasValidPlayerCount = game.supportedPlayerCounts.contains(validPlayers.count)
                let allPlayersSelected = !players.contains(nil)
                let hasValidScores = game.isBinaryScore || validateScores()
                return hasValidPlayerCount && allPlayersSelected && hasValidScores
            }
            return false
        }

        private func validateScores() -> Bool {
            if let game = selectedGame ?? self.game {
                if game.isBinaryScore {
                    // For binary score games, check that exactly one player is marked as winner
                    return scores.count == players.count && scores.filter { $0 == 1 }.count == 1
                } else if game.supportsMultipleRounds {
                    // For multiple rounds, check that we have at least one round
                    return !rounds.isEmpty
                        && rounds.allSatisfy { roundScores in
                            roundScores.count == players.count
                        }
                } else {
                    // For single round, check that all scores are set
                    return scores.count == players.count
                }
            }
            return false
        }

        init(
            game: Game? = nil, defaultPlayerIDs: [String]? = nil,
            onMatchSaved: ((Match) -> Void)? = nil
        ) {
            self.game = game
            self.defaultPlayerIDs = defaultPlayerIDs
            self.onMatchSaved = onMatchSaved
            let initialPlayers = defaultPlayerIDs?.map { _ in nil as Player? } ?? [nil, nil]
            _players = State(initialValue: initialPlayers)
            _scores = State(initialValue: Array(repeating: nil, count: initialPlayers.count))
            _selectedGame = State(initialValue: game)
            _rounds = State(
                initialValue: game?.supportsMultipleRounds == true
                    ? [Array(repeating: nil, count: initialPlayers.count)] : [])
        }

        private func adjustToLastMatchPlayerCount() {
            guard let game = selectedGame ?? self.game else { return }
            Task {
                do {
                    let matches = try await cloudKitManager.fetchMatches(for: game)
                    if let lastMatch = matches.first {
                        let count = lastMatch.playerIDs.count
                        if game.supportedPlayerCounts.contains(count) {
                            await MainActor.run {
                                players = Array(repeating: nil, count: count)
                                scores = Array(repeating: nil, count: count)
                            }
                        }
                    }
                } catch {
                    print("Error fetching matches: \(error)")
                    Analytics.logEvent(
                        "match_fetch_error",
                        parameters: [
                            "error": error.localizedDescription
                        ])
                }
            }
        }

        private func formatDistance(_ meters: CLLocationDistance) -> String {
            let feet = meters * 3.28084
            if feet < 10 {
                return "nearby"
            } else {
                return "\(Int(feet))ft away"
            }
        }

        var availablePlayers: [Player] {
            cloudKitManager.players.filter { player in
                // Don't show players that are already selected
                guard !players.compactMap { $0 }.contains(where: { $0.id == player.id }) else {
                    print("👥 NewMatchView: Player \(player.name) already selected")
                    #if canImport(FirebaseAnalytics)
                        Analytics.logEvent(
                            "player_filtered",
                            parameters: [
                                "player_name": player.name,
                                "reason": "already_selected",
                            ])
                    #endif
                    return false
                }

                // Show player if either:
                // 1. It's a managed player (owned by current user and no Apple ID)
                // 2. It's a nearby player (within 100 feet)
                if let userID = authManager.userID,
                    (player.ownerID == userID && player.appleUserID == nil)
                        || player.appleUserID == userID
                {
                    print("👥 NewMatchView: Player \(player.name) is managed or current user")
                    #if canImport(FirebaseAnalytics)
                        Analytics.logEvent(
                            "player_available",
                            parameters: [
                                "player_name": player.name,
                                "reason": "managed_or_current_user",
                            ])
                    #endif
                    return true
                }

                if let distance = locationManager.distanceToPlayer(player) {
                    let isNearby = distance <= 30.48  // 100 feet in meters
                    print(
                        "👥 NewMatchView: Player \(player.name) distance: \(Int(distance))m, isNearby: \(isNearby)"
                    )
                    #if canImport(FirebaseAnalytics)
                        Analytics.logEvent(
                            "player_distance_check",
                            parameters: [
                                "player_name": player.name,
                                "distance_meters": Int(distance),
                                "is_nearby": isNearby ? "true" : "false",
                            ])
                    #endif
                    return isNearby
                }

                print("👥 NewMatchView: Player \(player.name) has no valid distance")
                #if canImport(FirebaseAnalytics)
                    Analytics.logEvent(
                        "player_filtered",
                        parameters: [
                            "player_name": player.name,
                            "reason": "no_valid_distance",
                        ])
                #endif
                return false
            }.sorted { player1, player2 in
                // Sort current user first, then managed players, then by distance
                let isCurrentUser1 = player1.appleUserID == authManager.userID
                let isCurrentUser2 = player2.appleUserID == authManager.userID
                if isCurrentUser1 != isCurrentUser2 {
                    return isCurrentUser1
                }

                let isManaged1 = player1.ownerID == authManager.userID && player1.appleUserID == nil
                let isManaged2 = player2.ownerID == authManager.userID && player2.appleUserID == nil
                if isManaged1 != isManaged2 {
                    return isManaged1
                }

                let distance1 = locationManager.distanceToPlayer(player1) ?? .infinity
                let distance2 = locationManager.distanceToPlayer(player2) ?? .infinity
                return distance1 < distance2
            }
        }

        private func addRound() {
            rounds.append(Array(repeating: nil, count: players.count))
            currentRound = rounds.count - 1
            #if canImport(FirebaseAnalytics)
                Analytics.logEvent(
                    "round_added",
                    parameters: [
                        "round_number": rounds.count,
                        "player_count": players.count,
                    ])
            #endif
        }

        private func deleteRound(_ index: Int) {
            rounds.remove(at: index)
            if currentRound >= rounds.count {
                currentRound = max(0, rounds.count - 1)
            }
            #if canImport(FirebaseAnalytics)
                Analytics.logEvent(
                    "round_deleted",
                    parameters: [
                        "round_index": index,
                        "remaining_rounds": rounds.count,
                    ])
            #endif
        }

        private var gameSelectionSection: some View {
            Section("Game") {
                if game == nil {
                    Menu {
                        ForEach(cloudKitManager.games) { game in
                            Button(game.title) {
                                selectedGame = game
                                // Reset players and scores for new game
                                let minPlayers = game.supportedPlayerCounts.min() ?? 2
                                players = Array(repeating: nil, count: minPlayers)
                                scores = Array(repeating: nil, count: minPlayers)
                                // Initialize first round
                                if game.supportsMultipleRounds {
                                    rounds = [Array(repeating: nil, count: minPlayers)]
                                }
                            }
                        }

                        Divider()

                        Button {
                            showingAddGame = true
                        } label: {
                            HStack {
                                Text("Add Game")
                                Spacer()
                                Image(systemName: "plus.circle.fill")
                            }
                        }
                    } label: {
                        HStack {
                            Text(selectedGame?.title ?? "Select Game")
                                .foregroundColor(selectedGame == nil ? .secondary : .primary)
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down")
                                .foregroundColor(.secondary)
                                .font(.footnote)
                        }
                    }
                } else if let currentGame = game {
                    Text(currentGame.title)
                        .foregroundColor(.primary)
                }
            }
        }

        private func playerRow(for index: Int, in currentGame: Game) -> some View {
            HStack {
                Menu {
                    ForEach(availablePlayers) { player in
                        Button(player.name) {
                            players[index] = player
                        }
                    }

                    Divider()

                    Button {
                        showingAddPlayer = true
                    } label: {
                        HStack {
                            Text("Add Player")
                            Spacer()
                            Image(systemName: "plus.circle.fill")
                        }
                    }
                } label: {
                    HStack {
                        if let player = players[index] {
                            PlayerAvatar(player: player, size: 40)
                                .clipShape(Circle())
                            Text(player.name)
                                .foregroundColor(.primary)
                            Image(systemName: "chevron.up.chevron.down")
                                .foregroundColor(.secondary)
                                .font(.footnote)
                        } else {
                            Text("Player \(index + 1)")
                                .foregroundColor(.secondary)
                            Image(systemName: "chevron.up.chevron.down")
                                .foregroundColor(.secondary)
                                .font(.footnote)
                        }
                    }
                }

                Spacer()

                if currentGame.isBinaryScore {
                    if let player = players[index] {
                        Image(systemName: "crown.fill")
                            .foregroundStyle(scores[index] == 1 ? .yellow : .gray.opacity(0.3))
                            .onTapGesture {
                                // Reset all scores to 0
                                for i in scores.indices {
                                    scores[i] = 0
                                }
                                // Set this player as winner
                                scores[index] = 1
                            }
                    }
                } else if !currentGame.isBinaryScore {
                    if currentGame.supportsMultipleRounds {
                        if !rounds.isEmpty {
                            TextField(
                                "Score",
                                text: Binding(
                                    get: { rounds[0][index].map(String.init) ?? "" },
                                    set: { str in
                                        if let value = Int(str) {
                                            rounds[0][index] = value
                                        } else if str.isEmpty {
                                            rounds[0][index] = nil
                                        }
                                    }
                                )
                            )
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 60)
                        }
                    } else {
                        TextField(
                            "Score",
                            text: Binding(
                                get: { scores[index].map(String.init) ?? "" },
                                set: { str in
                                    if let value = Int(str) {
                                        scores[index] = value
                                    } else if str.isEmpty {
                                        scores[index] = nil
                                    }
                                }
                            )
                        )
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                    }
                }
            }
        }

        private func playersSection(for currentGame: Game) -> some View {
            Section(currentGame.supportsMultipleRounds ? "Round 1" : "Players") {
                ForEach(players.indices, id: \.self) { index in
                    playerRow(for: index, in: currentGame)
                }

                if currentGame.supportedPlayerCounts.contains(players.count + 1) {
                    Button(action: {
                        players.append(nil)
                        scores.append(nil)
                        if currentGame.supportsMultipleRounds {
                            for i in 0..<rounds.count {
                                rounds[i].append(nil)
                            }
                        }
                    }) {
                        Text("Add Player")
                    }
                }
            }
        }

        private func roundSection(index: Int, currentGame: Game) -> some View {
            Section("Round \(index + 1)") {
                ForEach(players.indices, id: \.self) { playerIndex in
                    if let player = players[playerIndex] {
                        HStack {
                            PlayerAvatar(player: player, size: 40)
                                .clipShape(Circle())
                            Text(player.name)
                            Spacer()
                            if !currentGame.isBinaryScore {
                                TextField(
                                    "Score",
                                    text: Binding(
                                        get: { rounds[index][playerIndex].map(String.init) ?? "" },
                                        set: { str in
                                            if let value = Int(str) {
                                                rounds[index][playerIndex] = value
                                            } else if str.isEmpty {
                                                rounds[index][playerIndex] = nil
                                            }
                                        }
                                    )
                                )
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 60)
                            }
                        }
                    }
                }
            }
        }

        private var totalScoresSection: some View {
            Section("Total Scores") {
                let totalScores = rounds.reduce(Array(repeating: 0, count: players.count)) {
                    totals, roundScores in
                    zip(totals, roundScores.map { $0 ?? 0 }).map(+)
                }
                ForEach(players.indices, id: \.self) { index in
                    if let player = players[index] {
                        HStack {
                            Text(player.name)
                            Spacer()
                            Text("\(totalScores[index])")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }

        private var addRoundButton: some View {
            Button(action: {
                if rounds.isEmpty {
                    // First round - initialize with current scores
                    rounds.append(scores.map { $0 ?? 0 })
                }
                rounds.append(Array(repeating: nil, count: players.count))
                Analytics.logEvent(
                    "round_added",
                    parameters: [
                        "round_number": rounds.count,
                        "player_count": players.count,
                    ])
            }) {
                Label("Add Round", systemImage: "plus.circle.fill")
                    .font(.headline)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .clipShape(Capsule())
            }
            .padding()
            .background(Color(.systemGroupedBackground))
        }

        var body: some View {
            NavigationStack {
                Form {
                    gameSelectionSection

                    if let currentGame = selectedGame ?? game {
                        playersSection(for: currentGame)

                        if currentGame.supportsMultipleRounds {
                            // Only show additional rounds if there are any
                            if rounds.count > 1 {
                                ForEach(1..<rounds.count, id: \.self) { roundIndex in
                                    roundSection(index: roundIndex, currentGame: currentGame)
                                }

                                totalScoresSection
                            }
                        }
                    }
                }
                .navigationTitle("New Match")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            dismiss()
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            saveMatch()
                        }
                        .disabled(!canSave)
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    if let currentGame = selectedGame ?? game,
                        currentGame.supportsMultipleRounds
                    {
                        addRoundButton
                    }
                }
                .sheet(isPresented: $showingAddGame) {
                    AddGameView()
                }
                .sheet(isPresented: $showingAddPlayer) {
                    NavigationStack {
                        PlayerFormView(
                            name: .constant(""),
                            color: .constant(.blue),
                            existingPhotoData: nil,
                            title: "New Player",
                            player: nil
                        )
                    }
                }
                .task {
                    if defaultPlayerIDs == nil {
                        adjustToLastMatchPlayerCount()
                    }
                    await loadPlayers()
                }
                .alert("Error", isPresented: $showingError) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(error?.localizedDescription ?? "An unknown error occurred")
                }
            }
            .onDisappear {
                locationManager.stopUpdatingLocation()
            }
        }

        private func loadPlayers() async {
            do {
                if let defaultPlayerIDs = defaultPlayerIDs {
                    let allPlayers = try await cloudKitManager.fetchPlayers()
                    for (index, playerId) in defaultPlayerIDs.enumerated() {
                        if let player = allPlayers.first(where: { $0.id == playerId }) {
                            players[index] = player
                        }
                    }
                    #if canImport(FirebaseAnalytics)
                        Analytics.logEvent(
                            "default_players_loaded",
                            parameters: [
                                "count": defaultPlayerIDs.count
                            ])
                    #endif
                }
            } catch {
                self.error = error
                showingError = true
                #if canImport(FirebaseAnalytics)
                    Analytics.logEvent(
                        "player_load_error",
                        parameters: [
                            "error": error.localizedDescription
                        ])
                #endif
            }
        }

        private func saveMatch() {
            guard let game = selectedGame ?? self.game else { return }

            var match = Match(createdByID: authManager.userID, game: game)
            match.playerIDs = players.compactMap { $0?.id }
            match.playerOrder = match.playerIDs
            match.isMultiplayer = players.count > 1

            if game.isBinaryScore {
                // For binary score games, find the winner from scores array
                if let winnerIndex = scores.firstIndex(of: 1) {
                    match.winnerID = match.playerIDs[winnerIndex]
                }
                match.scores = scores.map { $0 ?? 0 }
            } else if game.supportsMultipleRounds {
                // For multiple rounds, calculate total scores
                let totalScores = rounds.reduce(Array(repeating: 0, count: players.count)) {
                    totals, roundScores in
                    zip(totals, roundScores.map { $0 ?? 0 }).map(+)
                }
                match.scores = totalScores
                match.rounds = rounds.map { roundScores in
                    roundScores.map { $0 ?? 0 }
                }

                // Set winner based on highest total score
                if let maxScore = totalScores.max(),
                    let winnerIndex = totalScores.firstIndex(of: maxScore)
                {
                    match.winnerID = match.playerIDs[winnerIndex]
                }
            } else {
                // For single round games
                match.scores = scores.map { $0 ?? 0 }
                if let maxScore = match.scores.max(),
                    let winnerIndex = match.scores.firstIndex(of: maxScore)
                {
                    match.winnerID = match.playerIDs[winnerIndex]
                }
            }

            #if canImport(FirebaseAnalytics)
                Analytics.logEvent(
                    "match_saved",
                    parameters: [
                        "game_title": game.title,
                        "player_count": match.playerIDs.count,
                        "is_multiplayer": match.isMultiplayer ? "true" : "false",
                        "is_binary_score": game.isBinaryScore ? "true" : "false",
                        "has_multiple_rounds": game.supportsMultipleRounds ? "true" : "false",
                        "round_count": rounds.count,
                    ])
            #endif

            Task {
                do {
                    try await cloudKitManager.saveMatch(match)
                    onMatchSaved?(match)
                    dismiss()
                } catch {
                    self.error = error
                    showingError = true
                    #if canImport(FirebaseAnalytics)
                        Analytics.logEvent(
                            "match_save_error",
                            parameters: [
                                "error": error.localizedDescription
                            ])
                    #endif
                }
            }
        }
    }
#endif
