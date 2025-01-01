#if canImport(UIKit)
    import SwiftUI
    import CloudKit

    struct ActivityView: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var matches: [Match] = []
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false
        private let matchLimit = 50  // Limit to most recent 50 matches

        var sortedMatches: [Match] {
            matches.sorted { $0.date > $1.date }
        }

        var body: some View {
            NavigationStack {
                List {
                    if isLoading && matches.isEmpty {
                        ProgressView()
                    } else if matches.isEmpty {
                        Text("No matches yet")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(sortedMatches) { match in
                            ZStack {
                                NavigationLink(destination: MatchDetailView(match: match)) {
                                    EmptyView()
                                }
                                .opacity(0)

                                ActivityRow(match: match)
                            }
                        }
                    }
                }
            }
            .listStyle(.plain)
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
                _ = try await cloudKitManager.fetchGames(forceRefresh: forceRefresh)

                // Get recent matches
                let recentMatches = try await cloudKitManager.fetchRecentActivityMatches(
                    limit: matchLimit,
                    daysBack: 3
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
