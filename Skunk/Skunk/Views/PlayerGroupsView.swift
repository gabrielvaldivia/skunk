import SwiftUI

#if canImport(UIKit)
    struct PlayerGroupsView: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false

        var body: some View {
            List {
                ForEach(cloudKitManager.playerGroups) { group in
                    NavigationLink {
                        PlayerGroupDetailView(group: group)
                    } label: {
                        PlayerGroupRow(group: group)
                    }
                }
            }
            .navigationTitle("Groups")
            .task {
                await loadGroups()
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
        }

        private func loadGroups() async {
            isLoading = true
            do {
                _ = try await cloudKitManager.fetchPlayerGroups()
            } catch {
                self.error = error
                showingError = true
            }
            isLoading = false
        }
    }

    struct PlayerGroupRow: View {
        let group: PlayerGroup
        @EnvironmentObject private var cloudKitManager: CloudKitManager

        var body: some View {
            VStack(alignment: .leading) {
                Text(playerNames)
                    .font(.headline)
            }
        }

        private var playerNames: String {
            group.playerIDs
                .compactMap { cloudKitManager.getPlayer(id: $0)?.name }
                .sorted()
                .joined(separator: ", ")
        }
    }

    struct PlayerGroupDetailView: View {
        let group: PlayerGroup
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var matches: [Match] = []
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false

        // Group matches by game
        private var matchesByGame: [(game: Game, matches: [Match])] {
            let grouped = Dictionary(grouping: matches) { $0.game }
            return grouped.compactMap { game, matches in
                guard let game = game else { return nil }
                return (game: game, matches: matches)
            }.sorted { $0.game.title < $1.game.title }
        }

        private func matchesSection(for gameMatch: (game: Game, matches: [Match])) -> some View {
            Section(header: Text(gameMatch.game.title)) {
                VStack(alignment: .leading, spacing: 16) {
                    GameStatsView(
                        matches: gameMatch.matches,
                        game: gameMatch.game,
                        playerIDs: group.playerIDs
                    )

                    let sortedMatches = gameMatch.matches.sorted { $0.date > $1.date }
                    ForEach(sortedMatches) { match in
                        MatchRow(match: match)
                    }
                }
            }
        }

        private func playersSection() -> some View {
            Section(header: Text("Players")) {
                ForEach(group.playerIDs, id: \.self) { playerId in
                    if let player = cloudKitManager.getPlayer(id: playerId) {
                        Text(player.name)
                    }
                }
            }
        }

        private func emptySection() -> some View {
            Section(header: Text("")) {
                Text("No matches yet")
                    .foregroundColor(.secondary)
            }
        }

        var body: some View {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    playersSection()

                    if matches.isEmpty {
                        emptySection()
                    } else {
                        ForEach(matchesByGame, id: \.game.id) { gameMatch in
                            matchesSection(for: gameMatch)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle(playerNames)
            .task {
                await loadMatches()
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
        }

        private var playerNames: String {
            group.playerIDs
                .compactMap { cloudKitManager.getPlayer(id: $0)?.name }
                .sorted()
                .joined(separator: ", ")
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
