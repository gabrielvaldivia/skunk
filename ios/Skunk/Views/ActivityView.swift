#if canImport(UIKit)
    import SwiftUI
    import CloudKit

    struct ActivityView: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var matches: [Match] = []
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false
        private let matchLimit = 500  // Fetch up to 500 matches

        var sortedMatches: [Match] {
            matches.sorted { $0.date > $1.date }
        }

        var body: some View {
            NavigationStack {
                List {
                    if isLoading && matches.isEmpty {
                        ProgressView()
                    } else if matches.isEmpty {
                        Text("No matches yet. Start a session to invite others to play.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(sortedMatches) { match in
                            NavigationLink(destination: MatchDetailView(match: match)) {
                                MatchRow(match: match, hideGameTitle: false)
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
            .navigationTitle("Activity")
            .refreshable {
                await loadMatches(forceRefresh: true)
            }
            .task {
                await loadMatches(forceRefresh: false)
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
        }

        private func loadMatches(forceRefresh: Bool) async {
            // If we're not force refreshing and already have matches, don't reload
            if !forceRefresh && !matches.isEmpty {
                return
            }

            if matches.isEmpty {
                isLoading = true
            }
            defer { isLoading = false }

            do {
                // First, ensure we have all games loaded
                let allGames = try await cloudKitManager.fetchGames(forceRefresh: forceRefresh)
                _ = Dictionary(uniqueKeysWithValues: allGames.map { ($0.id, $0) })

                // Get all matches without time limit
                let recentMatches = try await cloudKitManager.fetchRecentActivityMatches(
                    limit: matchLimit,
                    daysBack: 365 * 10  // Look back 10 years
                )

                // Update UI
                await MainActor.run {
                    self.matches = recentMatches
                }

                // Load any missing players in the background
                Task {
                    let allPlayerIDs = Set(recentMatches.flatMap { $0.playerIDs })
                    let missingPlayerIDs = allPlayerIDs.filter { playerID in
                        !cloudKitManager.players.contains { $0.id == playerID }
                    }

                    if !missingPlayerIDs.isEmpty {
                        _ = try? await cloudKitManager.fetchPlayers(forceRefresh: true)
                    }
                }
            } catch {
                self.error = error
                showingError = true
            }
        }
    }
#endif
