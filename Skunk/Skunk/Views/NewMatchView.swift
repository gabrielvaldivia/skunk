import CloudKit
import CoreLocation
import SwiftUI

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
        @AppStorage("lastMatchPlayerIDs") private var lastMatchPlayerIDsString: String = "[]"
        @AppStorage("lastMatchPlayerCount") private var lastMatchPlayerCount: Int = 0
        @State private var showingAddGame = false

        private var lastMatchPlayerIDs: [String] {
            (try? JSONDecoder().decode([String].self, from: Data(lastMatchPlayerIDsString.utf8)))
                ?? []
        }

        private func setLastMatchPlayerIDs(_ ids: [String]) {
            if let encoded = try? JSONEncoder().encode(ids),
                let string = String(data: encoded, encoding: .utf8)
            {
                lastMatchPlayerIDsString = string
            }
        }

        let defaultGame: Game?
        let defaultPlayerIDs: [String]?
        let onMatchSaved: ((Match) -> Void)?
        @State private var selectedGame: Game?
        @State private var players: [Player?]
        @State private var scores: [Int]
        @State private var currentPlayerCount: Int
        @State private var allPlayers: [Player] = []
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false
        @State private var selectedWinnerIndex: Int?
        @State private var showingAddPlayer = false

        init(
            game: Game? = nil, defaultPlayerIDs: [String]? = nil,
            onMatchSaved: ((Match) -> Void)? = nil
        ) {
            self.defaultGame = game
            self.defaultPlayerIDs = defaultPlayerIDs
            self.onMatchSaved = onMatchSaved

            // If we have a game and default players and their count is supported, use that count
            let playerCount: Int
            if let game = game,
                let defaultCount = defaultPlayerIDs?.count,
                game.supportedPlayerCounts.contains(defaultCount)
            {
                playerCount = defaultCount
            } else {
                playerCount = 2  // Default to 2 players if no game selected
            }

            _selectedGame = State(initialValue: game)
            _currentPlayerCount = State(initialValue: playerCount)
            _players = State(initialValue: Array(repeating: nil, count: playerCount))
            _scores = State(initialValue: Array(repeating: 0, count: playerCount))
        }

        private func adjustToLastMatchPlayerCount() {
            // Adjust to last match player count if valid
            guard let game = selectedGame else { return }
            if game.supportedPlayerCounts.contains(lastMatchPlayerCount) && lastMatchPlayerCount > 0
            {
                let currentCount = players.count
                if lastMatchPlayerCount > currentCount {
                    // Add more player slots
                    players.append(
                        contentsOf: Array(
                            repeating: nil, count: lastMatchPlayerCount - currentCount))
                    scores.append(
                        contentsOf: Array(repeating: 0, count: lastMatchPlayerCount - currentCount))
                } else if lastMatchPlayerCount < currentCount {
                    // Remove excess player slots
                    players.removeLast(currentCount - lastMatchPlayerCount)
                    scores.removeLast(currentCount - lastMatchPlayerCount)
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
            allPlayers.filter { player in
                // Don't show players that are already selected
                guard !players.compactMap { $0 }.contains(where: { $0.id == player.id }) else {
                    return false
                }

                // Show player if either:
                // 1. It's a managed player (owned by current user and no Apple ID)
                // 2. It's a nearby player (within 100 feet)
                if let userID = authManager.userID,
                    player.ownerID == userID && player.appleUserID == nil
                {
                    return true
                }

                if let distance = locationManager.distanceToPlayer(player) {
                    return distance <= 30.48  // 100 feet in meters
                }

                return false
            }.sorted { player1, player2 in
                // Sort managed players first, then by distance
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

        var body: some View {
            NavigationStack {
                Form {
                    Section("Game") {
                        Menu {
                            ForEach(cloudKitManager.games) { game in
                                Button {
                                    selectedGame = game
                                    // Adjust player count to match game's minimum
                                    let minPlayers = game.supportedPlayerCounts.min() ?? 2
                                    if players.count < minPlayers {
                                        players = Array(repeating: nil, count: minPlayers)
                                        scores = Array(repeating: 0, count: minPlayers)
                                    }
                                } label: {
                                    Text(game.title)
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
                    }

                    Section("Players") {
                        ForEach(Array(players.enumerated()), id: \.offset) { index, player in
                            HStack {
                                Menu {
                                    let managedPlayers = availablePlayers.filter { player in
                                        player.ownerID == authManager.userID
                                            && player.appleUserID == nil
                                    }
                                    let nearbyPlayers = availablePlayers.filter { player in
                                        player.ownerID != authManager.userID
                                            || player.appleUserID != nil
                                    }.sorted { player1, player2 in
                                        let distance1 =
                                            locationManager.distanceToPlayer(player1)
                                            ?? .infinity
                                        let distance2 =
                                            locationManager.distanceToPlayer(player2)
                                            ?? .infinity
                                        return distance1 < distance2
                                    }

                                    if managedPlayers.isEmpty && nearbyPlayers.isEmpty {
                                        Text("No players available")
                                    } else {
                                        if !managedPlayers.isEmpty {
                                            Section("Offline Players") {
                                                ForEach(managedPlayers) { newPlayer in
                                                    Button {
                                                        players[index] = newPlayer
                                                    } label: {
                                                        Text(newPlayer.name)
                                                    }
                                                }

                                                Button {
                                                    showingAddPlayer = true
                                                } label: {
                                                    HStack {
                                                        Image(systemName: "plus.circle.fill")
                                                        Text("Add Player")
                                                    }
                                                }
                                                .accentColor(.blue)
                                            }
                                        }

                                        Section("Nearby Players") {
                                            switch locationManager.authorizationStatus {
                                            case .notDetermined:
                                                Button {
                                                    locationManager.requestLocationPermission()
                                                } label: {
                                                    HStack {
                                                        Image(systemName: "location.circle.fill")
                                                        Text("Enable Location Access")
                                                    }
                                                }
                                                .accentColor(.blue)
                                            case .restricted, .denied:
                                                Text(
                                                    "Location access is required to find nearby players"
                                                )
                                                .foregroundColor(.secondary)
                                            case .authorizedWhenInUse, .authorizedAlways:
                                                if nearbyPlayers.isEmpty {
                                                    Text("No players within 100 feet")
                                                        .foregroundColor(.secondary)
                                                } else {
                                                    ForEach(nearbyPlayers) { newPlayer in
                                                        Button {
                                                            players[index] = newPlayer
                                                        } label: {
                                                            HStack {
                                                                Text(newPlayer.name)
                                                                Spacer()
                                                                if let distance =
                                                                    locationManager.distanceToPlayer(
                                                                        newPlayer)
                                                                {
                                                                    Text(formatDistance(distance))
                                                                        .foregroundColor(.secondary)
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            @unknown default:
                                                Text(
                                                    "Location access is required to find nearby players"
                                                )
                                                .foregroundColor(.secondary)
                                            }
                                        }
                                    }
                                } label: {
                                    HStack {
                                        if let player = player {
                                            Text(player.name)
                                                .foregroundColor(.primary)
                                            if player.ownerID == authManager.userID
                                                && player.appleUserID == nil
                                            {
                                                Text("Offline")
                                                    .foregroundColor(.secondary)
                                            } else if let distance =
                                                locationManager.distanceToPlayer(player)
                                            {
                                                Text(formatDistance(distance))
                                                    .foregroundColor(.secondary)
                                            }
                                            Image(systemName: "chevron.up.chevron.down")
                                                .foregroundColor(.secondary)
                                                .font(.footnote)
                                        } else {
                                            Text("Select Player")
                                                .foregroundColor(.secondary)
                                            Image(systemName: "chevron.up.chevron.down")
                                                .foregroundColor(.secondary)
                                                .font(.footnote)
                                        }
                                        Spacer()
                                    }
                                }

                                if player != nil && selectedGame != nil {
                                    if selectedGame!.isBinaryScore {
                                        Toggle(
                                            "",
                                            isOn: Binding(
                                                get: { selectedWinnerIndex == index },
                                                set: { isWinner in
                                                    selectedWinnerIndex = isWinner ? index : nil
                                                }
                                            )
                                        )
                                        .tint(.green)
                                    } else {
                                        TextField(
                                            "Score", value: $scores[index], format: .number
                                        )
                                        .keyboardType(.numberPad)
                                        .multilineTextAlignment(.trailing)
                                        .frame(width: 80)
                                    }
                                }
                            }
                        }
                        .onDelete { indexSet in
                            guard let index = indexSet.first,
                                index >= (selectedGame?.supportedPlayerCounts.min() ?? 2)
                            else { return }
                            players.remove(at: index)
                            scores.remove(at: index)
                            if selectedWinnerIndex == index {
                                selectedWinnerIndex = nil
                            } else if let winner = selectedWinnerIndex, winner > index {
                                selectedWinnerIndex = winner - 1
                            }
                        }

                        if let game = selectedGame,
                            game.supportedPlayerCounts.contains(players.count + 1)
                        {
                            Button(action: {
                                players.append(nil)
                                scores.append(0)
                            }) {
                                Text("Add Player")
                            }
                        }
                    }
                }
                .navigationTitle(selectedGame.map { "New \($0.title) Match" } ?? "New Match")
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
                    // Only adjust player count if we don't have default players
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

        private var canSave: Bool {
            guard let game = selectedGame else { return false }
            let filledPlayers = players.compactMap { $0 }
            return !filledPlayers.isEmpty
                && filledPlayers.count >= (game.supportedPlayerCounts.min() ?? 2)
        }

        private func loadPlayers() async {
            isLoading = true
            do {
                print("Loading all players...")
                allPlayers = try await cloudKitManager.fetchPlayers()

                // Filter to only include real users (players with Apple IDs)
                guard let userID = authManager.userID else { return }
                allPlayers = allPlayers.filter { player in
                    player.appleUserID != nil  // Is a real user
                        || (player.ownerID == userID && player.appleUserID == nil)  // Or is a managed player
                }

                // Sort to match PlayersView order but without sections
                let currentUser = allPlayers.first { $0.appleUserID == userID }
                let managedPlayers = allPlayers.filter { player in
                    player.ownerID == userID && player.appleUserID != userID
                }
                let otherUsers = allPlayers.filter { player in
                    player.appleUserID != nil && player.appleUserID != userID
                        && player.ownerID != userID
                }

                // Reorder allPlayers to match the structure
                var orderedPlayers: [Player] = []
                if let currentUser = currentUser {
                    orderedPlayers.append(currentUser)
                }
                orderedPlayers.append(contentsOf: managedPlayers)
                orderedPlayers.append(contentsOf: otherUsers)
                allPlayers = orderedPlayers

                print("Loaded \(allPlayers.count) players: \(allPlayers.map { $0.name })")

                // If we have default player IDs, use those and ensure exact match
                if let defaultPlayerIDs = defaultPlayerIDs {
                    print("Using default players: \(defaultPlayerIDs)")
                    // Reset players array to match default count
                    players = Array(repeating: nil, count: defaultPlayerIDs.count)
                    scores = Array(repeating: 0, count: defaultPlayerIDs.count)

                    // Fill in all players in the exact order
                    for (index, playerId) in defaultPlayerIDs.enumerated() {
                        if let player = allPlayers.first(where: { $0.id == playerId }) {
                            players[index] = player
                        }
                    }
                }
                // If no default players, use last match players
                else if !lastMatchPlayerIDs.isEmpty {
                    print("Found last match players: \(lastMatchPlayerIDs)")
                    // Fill in as many slots as we have players and supported count allows
                    let lastPlayers = lastMatchPlayerIDs.compactMap { id in
                        allPlayers.first { $0.id == id }
                    }

                    for (index, player) in lastPlayers.enumerated() {
                        if index < players.count {
                            players[index] = player
                        }
                    }
                } else {
                    // First time - just set current user as player 1
                    if let currentUser = allPlayers.first(where: {
                        $0.appleUserID == authManager.userID
                    }) {
                        print("Setting current user: \(currentUser.name)")
                        players[0] = currentUser
                    }
                }

                print("Initial players array: \(players.map { $0?.name ?? "nil" })")
            } catch {
                print("Error loading players: \(error.localizedDescription)")
                self.error = error
                showingError = true
            }
            isLoading = false
        }

        private func saveMatch() {
            Task {
                do {
                    guard let game = selectedGame else { return }
                    var match = Match(date: Date(), createdByID: authManager.userID, game: game)
                    let filledPlayers = players.compactMap { $0 }

                    // Save the current players and count
                    setLastMatchPlayerIDs(filledPlayers.map { $0.id })
                    lastMatchPlayerCount = players.count

                    // Use the existing player IDs directly
                    match.playerIDs = filledPlayers.map { $0.id }
                    match.playerOrder = match.playerIDs
                    match.status = selectedWinnerIndex != nil ? "completed" : "active"

                    if game.isBinaryScore {
                        if let winnerIndex = selectedWinnerIndex,
                            let winner = players[winnerIndex]
                        {
                            match.winnerID = winner.id
                        }
                    } else {
                        // For games with scores, find the winner based on highest score
                        if let maxScoreIndex = scores.enumerated()
                            .max(by: { $0.element < $1.element })?.offset,
                            let winner = players[maxScoreIndex]
                        {
                            match.winnerID = winner.id
                        }
                        match.scores = scores
                    }

                    try await cloudKitManager.saveMatch(match)
                    onMatchSaved?(match)
                    dismiss()
                } catch {
                    print("Error saving match: \(error.localizedDescription)")
                    self.error = error
                    showingError = true
                }
            }
        }
    }
#endif
