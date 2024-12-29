import SwiftUI

#if canImport(UIKit)
    struct PlayerGroupsView: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var error: Error?
        @State private var showingError = false

        var body: some View {
            ZStack {
                if cloudKitManager.isLoading {
                    ProgressView()
                } else {
                    List {
                        ForEach(cloudKitManager.playerGroups) { group in
                            NavigationLink {
                                PlayerGroupDetailView(group: group)
                            } label: {
                                PlayerGroupRow(group: group)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Groups")
            .task {
                await loadGroups()
            }
            .refreshable {
                await loadGroups()
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
        }

        private func loadGroups() async {
            do {
                _ = try await cloudKitManager.fetchPlayerGroups()
            } catch {
                self.error = error
                showingError = true
            }
        }
    }

    struct PlayerGroupRow: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        let group: PlayerGroup

        private var playerNames: String {
            let names = group.playerIDs.compactMap { id in
                cloudKitManager.getPlayer(id: id)?.name
            }

            switch names.count {
            case 0:
                return "No players"
            case 1:
                return names[0]
            case 2:
                return "\(names[0]) & \(names[1])"
            default:
                let allButLast = names.dropLast().joined(separator: ", ")
                return "\(allButLast), & \(names.last!)"
            }
        }

        var body: some View {
            Text(playerNames)
        }
    }

    struct PlayerGroupDetailView: View {
        let group: PlayerGroup
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var matches: [Match] = []
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false
        @State private var selectedGameId: String? = nil
        @State private var showingNewMatch = false

        private var games: [Game] {
            // Get unique games from matches, sorted by title
            let uniqueGames = Set(matches.compactMap { $0.game })
            return Array(uniqueGames).sorted { $0.title < $1.title }
        }

        private var filteredMatches: [Match] {
            if let selectedGameId = selectedGameId {
                return matches.filter { $0.game?.id == selectedGameId }
            }
            return matches
        }

        private var winCounts: [(player: Player, count: Int)] {
            // Get all players who have participated in matches
            var allPlayers = Set<Player>()
            var counts: [Player: Int] = [:]

            // First collect all players who have participated
            for match in filteredMatches {
                for playerID in match.playerIDs {
                    if let player = cloudKitManager.players.first(where: { $0.id == playerID }) {
                        allPlayers.insert(player)
                    }
                }
            }

            // Then count wins
            for match in filteredMatches {
                if let winnerID = match.winnerID,
                    let winner = cloudKitManager.players.first(where: { $0.id == winnerID })
                {
                    counts[winner, default: 0] += 1
                }
            }

            // Ensure all players are in counts, even with 0 wins
            for player in allPlayers {
                if counts[player] == nil {
                    counts[player] = 0
                }
            }

            // Convert to array of tuples
            var pairs: [(player: Player, count: Int)] = []
            for (player, count) in counts {
                pairs.append((player: player, count: count))
            }

            // Sort by count (highest first), then by name for ties
            pairs.sort { pair1, pair2 in
                if pair1.count != pair2.count {
                    return pair1.count > pair2.count
                }
                return pair1.player.name < pair2.player.name
            }
            return pairs
        }

        private var totalWins: Int {
            winCounts.reduce(0) { $0 + $1.count }
        }

        private func calculateWinPercentage(count: Int) -> Int {
            guard totalWins > 0 else { return 0 }
            let percentage = Double(count) / Double(totalWins) * 100.0
            return Int(percentage)
        }

        private func playerStatsView(_ entry: (player: Player, count: Int)) -> some View {
            HStack {
                Circle()
                    .fill(entry.player.color)
                    .frame(width: 12, height: 12)
                Text(entry.player.name)
                Spacer()
                Text("\(calculateWinPercentage(count: entry.count))%")
                    .foregroundStyle(.secondary)
            }
        }

        private func playerRow(_ index: Int, _ entry: (player: Player, count: Int)) -> some View {
            NavigationLink {
                PlayerDetailView(player: entry.player)
            } label: {
                HStack(spacing: 16) {
                    Text("#\(index + 1)")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                        .frame(width: 40)

                    PlayerAvatar(player: entry.player)

                    VStack(alignment: .leading) {
                        Text(entry.player.name)
                            .font(.headline)
                    }

                    Spacer()

                    Text("\(entry.count) wins")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }

        private func winDistributionSection() -> some View {
            Section("Win Distribution") {
                VStack(alignment: .center, spacing: 16) {
                    if totalWins > 0 {
                        PieChartView(winCounts: winCounts, totalWins: totalWins)
                            .padding(.vertical)
                    }

                    ForEach(winCounts, id: \.player.id) { entry in
                        playerStatsView(entry)
                    }
                }
                .padding(20)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .frame(maxWidth: .infinity)
                .listRowInsets(EdgeInsets())
            }
        }

        private func matchHistorySection(_ matches: [Match]) -> some View {
            Section("Match History") {
                if matches.isEmpty {
                    Text("No matches")
                        .foregroundColor(.secondary)
                } else {
                    ForEach(matches.sorted { $0.date > $1.date }) { match in
                        NavigationLink {
                            MatchDetailView(match: match)
                        } label: {
                            MatchRow(match: match)
                        }
                    }
                }
            }
        }

        private func activitySection(_ matches: [Match]) -> some View {
            Section("Activity") {
                ActivityGridView(matches: Array(matches))
                    .listRowInsets(EdgeInsets())
            }
        }

        var body: some View {
            ZStack {
                if isLoading {
                    ProgressView()
                } else if matches.isEmpty {
                    VStack(spacing: 8) {
                        Text("No Matches")
                            .font(.headline)
                            .fontWeight(.semibold)
                        Text("Play some matches with this group to see stats")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    List {
                        // Game Picker - only show if there's more than one game
                        if games.count > 1 {
                            Section {
                                Picker("Game", selection: $selectedGameId) {
                                    Text("All Games").tag(Optional<String>.none)
                                    ForEach(games) { game in
                                        Text(game.title).tag(Optional(game.id))
                                    }
                                }
                                .pickerStyle(.menu)
                            }
                        }

                        // Leaderboard
                        Section("Leaderboard") {
                            ForEach(Array(winCounts.enumerated()), id: \.element.player.id) {
                                index, entry in
                                playerRow(index, entry)
                            }
                        }

                        if totalWins > 0 {
                            winDistributionSection()
                        }
                        activitySection(filteredMatches)
                        matchHistorySection(filteredMatches)
                    }
                }

                // Add floating action button
                if let selectedGame = games.first(where: { $0.id == selectedGameId }) ?? games.first
                {
                    VStack {
                        Spacer()
                        HStack {
                            Spacer()
                            Button(action: {
                                showingNewMatch = true
                            }) {
                                Text("New Match")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 24)
                                    .padding(.vertical, 12)
                                    .background(Color.blue)
                                    .clipShape(RoundedRectangle(cornerRadius: 24))
                                    .shadow(radius: 4, y: 2)
                            }
                            Spacer()
                        }
                        .padding(.bottom, 20)
                    }
                }
            }
            .navigationTitle(playerNames)
            .task {
                await loadMatches()
                // Auto-select the only game if there's just one
                if games.count == 1 {
                    selectedGameId = games[0].id
                }
            }
            .refreshable {
                await loadMatches()
            }
            .sheet(isPresented: $showingNewMatch) {
                if let selectedGame = games.first(where: { $0.id == selectedGameId }) ?? games.first
                {
                    NewMatchView(
                        game: selectedGame,
                        defaultPlayerIDs: group.playerIDs,
                        onMatchSaved: { newMatch in
                            matches.insert(newMatch, at: 0)
                            Task {
                                await loadMatches()
                            }
                        }
                    )
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
        }

        private var playerNames: String {
            let names = group.playerIDs.compactMap { cloudKitManager.getPlayer(id: $0)?.name }

            switch names.count {
            case 0:
                return "No players"
            case 1:
                return names[0]
            case 2:
                return "\(names[0]) & \(names[1])"
            default:
                let allButLast = names.dropLast().joined(separator: ", ")
                return "\(allButLast), & \(names.last!)"
            }
        }

        private func loadMatches() async {
            isLoading = true
            do {
                // Load all games and their matches
                let games = try await cloudKitManager.fetchGames()
                var allMatches: [Match] = []

                for game in games {
                    let gameMatches = try await cloudKitManager.fetchMatches(for: game)
                    // Filter matches to only include those with exactly these players
                    let groupMatches = gameMatches.filter { match in
                        Set(match.playerIDs) == Set(group.playerIDs)
                    }
                    allMatches.append(contentsOf: groupMatches)
                }

                // Sort by date, newest first
                matches = allMatches.sorted { $0.date > $1.date }
            } catch {
                self.error = error
                showingError = true
            }
            isLoading = false
        }
    }

    struct GameStatsView: View {
        let matches: [Match]
        let game: Game
        let playerIDs: [String]
        @EnvironmentObject private var cloudKitManager: CloudKitManager

        var body: some View {
            VStack(alignment: .leading, spacing: 16) {
                // Win Distribution
                VStack(alignment: .leading) {
                    Text("Win Distribution")
                        .font(.headline)

                    ForEach(playerIDs.sorted(), id: \.self) { playerId in
                        if let player = cloudKitManager.getPlayer(id: playerId) {
                            HStack {
                                Text(player.name)
                                Spacer()
                                Text("\(winCount(for: playerId)) wins")
                            }
                        }
                    }
                }

                // Average Scores (if not binary)
                if !game.isBinaryScore {
                    VStack(alignment: .leading) {
                        Text("Average Scores")
                            .font(.headline)

                        ForEach(playerIDs.sorted(), id: \.self) { playerId in
                            if let player = cloudKitManager.getPlayer(id: playerId) {
                                HStack {
                                    Text(player.name)
                                    Spacer()
                                    Text(String(format: "%.1f", averageScore(for: playerId)))
                                }
                            }
                        }
                    }
                }
            }
        }

        private func winCount(for playerId: String) -> Int {
            matches.filter { $0.winnerID == playerId }.count
        }

        private func averageScore(for playerId: String) -> Double {
            let playerMatches = matches.filter { match in
                guard let playerIndex = match.playerIDs.firstIndex(of: playerId),
                    playerIndex < match.scores.count
                else { return false }
                return true
            }

            let totalScore = playerMatches.reduce(0.0) { total, match in
                if let playerIndex = match.playerIDs.firstIndex(of: playerId),
                    playerIndex < match.scores.count
                {
                    return total + Double(match.scores[playerIndex])
                }
                return total
            }

            return playerMatches.isEmpty ? 0 : totalScore / Double(playerMatches.count)
        }
    }
#endif
