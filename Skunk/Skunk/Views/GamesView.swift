import CloudKit
import SwiftUI

#if canImport(UIKit)
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
                                Text(game.title)
                            }
                        }
                        .onDelete(perform: deleteGames)
                    }
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
