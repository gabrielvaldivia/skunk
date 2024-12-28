import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerDetailView: View {
        @EnvironmentObject var cloudKitManager: CloudKitManager
        @EnvironmentObject var authManager: AuthenticationManager
        @Environment(\.dismiss) var dismiss
        @State private var playerMatches: [Match] = []
        @State private var showingEditSheet = false

        let player: Player

        private var currentPlayer: Player {
            cloudKitManager.players.first(where: { $0.id == player.id }) ?? player
        }

        var isCurrentUserProfile: Bool {
            currentPlayer.appleUserID == authManager.userID
        }

        var canDelete: Bool {
            !isCurrentUserProfile && currentPlayer.ownerID == authManager.userID
        }

        var body: some View {
            List {
                PlayerInfoSection(playerId: player.id)
                matchHistorySection

                if canDelete {
                    Section {
                        Button(role: .destructive) {
                            try? await cloudKitManager.deletePlayer(currentPlayer)
                            dismiss()
                        } label: {
                            Text("Delete Player")
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .navigationTitle(currentPlayer.name)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if isCurrentUserProfile {
                        Button {
                            showingEditSheet = true
                        } label: {
                            Text("Edit")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingEditSheet) {
                NavigationStack {
                    PlayerFormView(
                        name: .init(get: { currentPlayer.name }, set: { _ in }),
                        color: .init(get: { currentPlayer.color }, set: { _ in }),
                        existingPhotoData: currentPlayer.photoData,
                        title: "Edit Player",
                        player: player
                    )
                }
            }
            .task {
                await loadPlayerData()
            }
            .refreshable {
                await loadPlayerData()
            }
        }

        private func loadPlayerData() async {
            do {
                let games = try await cloudKitManager.fetchGames()
                var newMatches: [Match] = []

                for game in games {
                    if let matches = try? await cloudKitManager.fetchMatches(for: game) {
                        newMatches.append(
                            contentsOf: matches.filter { $0.playerIDs.contains(player.id) })
                    }
                }

                playerMatches = newMatches.sorted { $0.date > $1.date }
            } catch {
                print("Error loading matches: \(error.localizedDescription)")
            }
        }

        private var matchHistorySection: some View {
            Section("Match History") {
                if playerMatches.isEmpty {
                    Text("No matches played")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(playerMatches) { match in
                        NavigationLink {
                            MatchDetailView(match: match)
                        } label: {
                            MatchRow(match: match)
                        }
                    }
                }
            }
        }
    }
#endif
