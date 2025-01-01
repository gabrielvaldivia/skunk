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

        private var cachedMatches: [Match]? {
            cloudKitManager.getMatchesForGame(game.id)
        }

        var body: some View {
            VStack(alignment: .leading, spacing: 4) {
                Text(game.title)
                    .font(.body)
                    .fontWeight(.semibold)
                MatchSubtitle(
                    matches: matches,
                    isLoading: isLoading,
                    currentPlayer: currentPlayer,
                    showOpponent: true,
                    cachedMatches: cachedMatches
                )
            }
            .task {
                await loadMatches()
            }
        }

        private func loadMatches() async {
            // If we have cached matches and current player, don't block on loading
            if cachedMatches != nil, currentPlayer != nil {
                Task {
                    await loadMatchesFromNetwork()
                }
                return
            }

            await loadMatchesFromNetwork()
        }

        private func loadMatchesFromNetwork() async {
            guard !isLoading else { return }
            isLoading = true
            defer { isLoading = false }

            do {
                let players = try await cloudKitManager.fetchPlayers(forceRefresh: false)

                // Set current player
                if let appleUserID = authManager.userID {
                    currentPlayer = players.first { $0.appleUserID == appleUserID }
                }

                // Get only the most recent match for this game
                if let lastMatch = try? await cloudKitManager.fetchRecentMatches(
                    forGame: game.id, limit: 1
                ).first {
                    // Cache the match
                    cloudKitManager.cacheMatchesForGame([lastMatch], gameId: game.id)

                    // Update the UI
                    await MainActor.run {
                        matches = [lastMatch]
                    }
                }
            } catch {
                print("🔴 GameRow Error loading matches: \(error)")
            }
        }
    }

    struct GamesView: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @EnvironmentObject private var authManager: AuthenticationManager
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
                games.sort {
                    $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
                }
            } catch {
                self.error = error
                showingError = true
            }
            isLoading = false
        }

        private func deleteGames(at offsets: IndexSet) {
            Task {
                do {
                    // Get the current user's ID
                    guard let currentUserID = authManager.userID else {
                        self.error = NSError(
                            domain: "", code: 0,
                            userInfo: [
                                NSLocalizedDescriptionKey: "You must be signed in to delete games."
                            ])
                        showingError = true
                        return
                    }

                    // Check if the user is the admin (you)
                    let adminEmail = "valdivia.gabriel@gmail.com"
                    let isAdmin =
                        cloudKitManager.getCurrentUser(withID: currentUserID)?.appleUserID
                        == adminEmail

                    for index in offsets {
                        let game = games[index]

                        // Allow deletion if user is admin or created the game
                        if isAdmin || game.createdByID == currentUserID {
                            try await cloudKitManager.deleteGame(game)
                            games.remove(at: index)
                        } else {
                            self.error = NSError(
                                domain: "", code: 0,
                                userInfo: [
                                    NSLocalizedDescriptionKey:
                                        "You can only delete games that you created."
                                ])
                            showingError = true
                            return
                        }
                    }
                } catch {
                    self.error = error
                    showingError = true
                }
            }
        }
    }
#endif
