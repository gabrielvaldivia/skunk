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
                            MatchActivityRow(match: match)
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

    struct MatchActivityRow: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        let match: Match

        private var relativeTimeString: String {
            let timeInterval = Date().timeIntervalSince(match.date)
            if timeInterval < 60 {  // Less than a minute ago
                return "just now"
            } else {
                let formatter = RelativeDateTimeFormatter()
                formatter.unitsStyle = .abbreviated
                return formatter.localizedString(for: match.date, relativeTo: Date())
            }
        }

        var body: some View {
            NavigationLink {
                MatchDetailView(match: match)
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    if let winner = cloudKitManager.players.first(where: { $0.id == match.winnerID }
                    ) {
                        PlayerAvatar(player: winner, size: 40)
                            .clipShape(Circle())
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        if let winner = cloudKitManager.players.first(where: {
                            $0.id == match.winnerID
                        }),
                            let game = match.game
                        {
                            let otherPlayers = match.playerIDs
                                .filter { $0 != winner.id }
                                .compactMap { id in cloudKitManager.getPlayer(id: id) }
                                .map { $0.name }

                            if otherPlayers.isEmpty {
                                Text("\(winner.name) won at \(game.title)")
                                    .font(.body)
                            } else if otherPlayers.count == 1 {
                                Text("\(winner.name) beat \(otherPlayers[0]) at \(game.title)")
                                    .font(.body)
                            } else if otherPlayers.count == 2 {
                                Text(
                                    "\(winner.name) beat \(otherPlayers[0]) and \(otherPlayers[1]) at \(game.title)"
                                )
                                .font(.body)
                            } else {
                                let allButLast = otherPlayers.dropLast().joined(separator: ", ")
                                let last = otherPlayers.last!
                                Text(
                                    "\(winner.name) beat \(allButLast), and \(last) at \(game.title)"
                                )
                                .font(.body)
                            }
                        }

                        Text(relativeTimeString)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
#endif
