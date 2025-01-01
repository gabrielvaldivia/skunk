import SwiftUI

#if canImport(UIKit)
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

        private var players: [Player] {
            group.playerIDs.compactMap { id in
                cloudKitManager.getPlayer(id: id)
            }
        }

        private var displayName: String {
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
            LeaderboardRow(rank: index + 1, player: entry.player, wins: entry.count)
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
                            MatchRow(match: match, hideGameTitle: selectedGameId != nil)
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

        private var selectedGameTitle: String {
            if let gameId = selectedGameId,
                let game = games.first(where: { $0.id == gameId })
            {
                return game.title
            }
            return "All Games"
        }

        var body: some View {
            ZStack {
                if isLoading {
                    ProgressView()
                } else if matches.isEmpty {
                    VStack(spacing: 8) {
                        // Group Info Section
                        Section {
                            VStack(spacing: 12) {
                                // Facepile
                                HStack(spacing: -16) {
                                    ForEach(players.prefix(3)) { player in
                                        PlayerAvatar(player: player, size: 80)
                                            .clipShape(Circle())
                                            .overlay(
                                                Circle()
                                                    .stroke(Color(.systemBackground), lineWidth: 3)
                                            )
                                    }
                                    if players.count > 3 {
                                        Text("+\(players.count - 3)")
                                            .font(.title3)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 4)
                                            .background(Color(.systemGray5))
                                            .clipShape(Capsule())
                                    }
                                }
                                .padding(.top, 8)

                                Text(displayName)
                                    .font(.system(size: 28))
                                    .fontWeight(.bold)
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .multilineTextAlignment(.center)

                                if games.count > 1 {
                                    Menu {
                                        Button("All Games") {
                                            selectedGameId = nil
                                        }
                                        ForEach(games) { game in
                                            Button(game.title) {
                                                selectedGameId = game.id
                                            }
                                        }
                                    } label: {
                                        HStack {
                                            Text(selectedGameTitle)
                                            Image(systemName: "chevron.up.chevron.down")
                                                .imageScale(.small)
                                        }
                                        .foregroundStyle(.blue)
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .listRowBackground(Color.clear)
                        }

                        Text("No Matches")
                            .font(.headline)
                            .fontWeight(.semibold)
                        Text("Play some matches with this group to see stats")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    List {
                        // Group Info Section
                        Section {
                            VStack(spacing: 12) {
                                // Facepile
                                HStack(spacing: -16) {
                                    ForEach(players.prefix(3)) { player in
                                        PlayerAvatar(player: player, size: 80)
                                            .clipShape(Circle())
                                            .overlay(
                                                Circle()
                                                    .stroke(Color(.systemBackground), lineWidth: 3)
                                            )
                                    }
                                    if players.count > 3 {
                                        Text("+\(players.count - 3)")
                                            .font(.title3)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 4)
                                            .background(Color(.systemGray5))
                                            .clipShape(Capsule())
                                    }
                                }
                                .padding(.top, 8)

                                Text(displayName)
                                    .font(.system(size: 28))
                                    .fontWeight(.bold)
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .multilineTextAlignment(.center)

                                if games.count > 1 {
                                    Menu {
                                        Button("All Games") {
                                            selectedGameId = nil
                                        }
                                        ForEach(games) { game in
                                            Button(game.title) {
                                                selectedGameId = game.id
                                            }
                                        }
                                    } label: {
                                        HStack {
                                            Text(selectedGameTitle)
                                            Image(systemName: "chevron.up.chevron.down")
                                                .imageScale(.small)
                                        }
                                        .foregroundStyle(.blue)
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .listRowBackground(Color.clear)
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
                if games.first(where: { $0.id == selectedGameId }) != nil {
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
            .task {
                await loadMatches()
            }
            .refreshable {
                await loadMatches()
            }
            .sheet(isPresented: $showingNewMatch) {
                if let selectedGame = games.first(where: { $0.id == selectedGameId }) {
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

        private func loadMatches() async {
            isLoading = true
            do {
                let games = try await cloudKitManager.fetchGames()
                var allMatches: [Match] = []

                for game in games {
                    let gameMatches = try await cloudKitManager.fetchMatches(for: game)
                    let groupMatches = gameMatches.filter { match in
                        Set(match.playerIDs) == Set(group.playerIDs)
                    }
                    allMatches.append(contentsOf: groupMatches)
                }

                matches = allMatches.sorted { $0.date > $1.date }
            } catch {
                self.error = error
                showingError = true
            }
            isLoading = false
        }
    }
#endif
