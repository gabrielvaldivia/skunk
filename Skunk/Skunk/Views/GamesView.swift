import CloudKit
import SwiftUI

#if canImport(UIKit)
    struct GameRow: View {
        let game: Game
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @EnvironmentObject private var authManager: AuthenticationManager
        @State private var matches: [Match] = []
        @State private var isLoading = false
        @State private var currentPlayer: Player?

        private var subtitle: String {
            if isLoading {
                return "Loading..."
            }

            print("🔍 GameRow: Calculating subtitle")
            print("🔍 GameRow: Current player = \(currentPlayer?.name ?? "nil")")
            print("🔍 GameRow: Total matches = \(matches.count)")

            guard let player = currentPlayer else {
                print("🔍 GameRow: No current player")
                return "No matches yet"
            }

            print(
                "🔍 GameRow: Matches with player = \(matches.filter { $0.playerIDs.contains(player.id) }.count)"
            )

            guard let lastMatch = matches.first(where: { $0.playerIDs.contains(player.id) }) else {
                print("🔍 GameRow: No matches found for player")
                return "No matches yet"
            }

            print("🔍 GameRow: Found last match with date \(lastMatch.date)")
            print("🔍 GameRow: Match players = \(lastMatch.playerIDs)")

            let otherPlayers = lastMatch.playerIDs
                .filter { $0 != player.id }
                .compactMap { id -> Player? in
                    let player = cloudKitManager.getPlayer(id: id)
                    print("🔍 GameRow: Looking up player \(id): \(player?.name ?? "not found")")
                    return player
                }

            guard let opponent = otherPlayers.first else {
                print("🔍 GameRow: No opponent found")
                return "No matches yet"
            }

            print("🔍 GameRow: Found opponent: \(opponent.name)")

            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .full
            let timeAgo = formatter.localizedString(for: lastMatch.date, relativeTo: Date())
            return "Last played against \(opponent.name) \(timeAgo)"
        }

        var body: some View {
            VStack(alignment: .leading, spacing: 4) {
                Text(game.title)
                    .font(.body)
                    .fontWeight(.semibold)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .task {
                print("🔍 GameRow: Loading data for \(game.title)")
                await loadMatches()
            }
        }

        private func loadMatches() async {
            guard !isLoading else { return }
            isLoading = true
            defer { isLoading = false }

            do {
                print("🔍 GameRow: Loading players")
                let players = try await cloudKitManager.fetchPlayers(forceRefresh: false)
                print("🔍 GameRow: Loaded \(players.count) players")

                // Find the current player
                if let appleUserID = authManager.userID {
                    currentPlayer = players.first { $0.appleUserID == appleUserID }
                    print("🔍 GameRow: Found current player: \(currentPlayer?.name ?? "nil")")
                }

                print("🔍 GameRow: Loading matches for \(game.title)")
                let gameMatches = try await cloudKitManager.fetchMatches(for: game)
                print("🔍 GameRow: Loaded \(gameMatches.count) matches")

                // Check if we need to fetch any missing players
                let allPlayerIDs = Set(gameMatches.flatMap { $0.playerIDs })
                let missingPlayerIDs = allPlayerIDs.filter { playerID in
                    cloudKitManager.getPlayer(id: playerID) == nil
                }

                print("🔍 GameRow: Missing \(missingPlayerIDs.count) players")

                // If we're missing any players, force refresh the players
                if !missingPlayerIDs.isEmpty {
                    print("🔍 GameRow: Refreshing players")
                    let refreshedPlayers = try await cloudKitManager.fetchPlayers(
                        forceRefresh: true)
                    print("🔍 GameRow: Refreshed \(refreshedPlayers.count) players")

                    // Update current player if needed
                    if let appleUserID = authManager.userID {
                        currentPlayer = refreshedPlayers.first { $0.appleUserID == appleUserID }
                        print("🔍 GameRow: Updated current player: \(currentPlayer?.name ?? "nil")")
                    }
                }

                matches = gameMatches.sorted { $0.date > $1.date }
                print("🔍 GameRow: Set \(matches.count) sorted matches")
            } catch {
                print("🔴 GameRow Error loading matches: \(error)")
            }
        }
    }

    struct GamesView: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var games: [Game] = []
        @State private var showingAddGame = false
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false

        var body: some View {
            ZStack {
                if isLoading {
                    ProgressView()
                } else if games.isEmpty {
                    VStack(spacing: 8) {
                        Text("No Games")
                            .font(.headline)
                            .fontWeight(.semibold)
                        Text("Tap the button above to add a game")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    List {
                        ForEach(games) { game in
                            NavigationLink(destination: GameDetailView(game: game)) {
                                GameRow(game: game)
                            }
                        }
                        .onDelete(perform: deleteGames)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Games")
            .toolbar {
                Button(action: { showingAddGame.toggle() }) {
                    Label("Add Game", systemImage: "plus")
                }
            }
            .sheet(isPresented: $showingAddGame) {
                AddGameView()
                    .onDisappear {
                        Task {
                            await loadGames()
                        }
                    }
            }
            .task {
                await loadGames()
            }
            .refreshable {
                await loadGames()
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
        }

        private func loadGames() async {
            isLoading = true
            do {
                games = try await cloudKitManager.fetchGames()
            } catch {
                self.error = error
                showingError = true
            }
            isLoading = false
        }

        private func deleteGames(at offsets: IndexSet) {
            Task {
                do {
                    for index in offsets {
                        let game = games[index]
                        try await cloudKitManager.deleteGame(game)
                        games.remove(at: index)
                    }
                } catch {
                    self.error = error
                    showingError = true
                }
            }
        }
    }
#endif
