#if canImport(UIKit)
    import SwiftUI
    import CloudKit

    struct ActivityView: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var matches: [Match] = []
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false

        var sortedMatches: [Match] {
            matches.sorted { $0.date > $1.date }
        }

        var body: some View {
            NavigationStack {
                List {
                    if isLoading {
                        ProgressView()
                    } else if matches.isEmpty {
                        Text("No matches yet")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(sortedMatches) { match in
                            ActivityRow(match: match)
                        }
                    }
                }
                .navigationTitle("Activity")
                .refreshable {
                    await loadMatches()
                }
                .task {
                    await loadMatches()
                }
                .alert("Error", isPresented: $showingError) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(error?.localizedDescription ?? "An unknown error occurred")
                }
            }
        }

        private func loadMatches() async {
            isLoading = true
            defer { isLoading = false }

            do {
                // First, ensure we have all players loaded
                _ = try await cloudKitManager.fetchPlayers(forceRefresh: false)

                // Then load matches from all games
                var allMatches: [Match] = []
                for game in cloudKitManager.games {
                    let fetchedMatches = try await cloudKitManager.fetchMatches(for: game)
                    allMatches.append(contentsOf: fetchedMatches)
                }

                // Check if we need to fetch any missing players
                let allPlayerIDs = Set(allMatches.flatMap { $0.playerIDs })
                let missingPlayerIDs = allPlayerIDs.filter { playerID in
                    !cloudKitManager.players.contains { $0.id == playerID }
                }

                // If we're missing any players, force refresh the players
                if !missingPlayerIDs.isEmpty {
                    _ = try await cloudKitManager.fetchPlayers(forceRefresh: true)
                }

                self.matches = allMatches
            } catch {
                self.error = error
                showingError = true
            }
        }
    }
#endif
