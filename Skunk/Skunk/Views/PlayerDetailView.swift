import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerDetailView: View {
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @EnvironmentObject private var authManager: AuthenticationManager
        let player: Player

        @State private var showingEditSheet = false
        @State private var editingName = ""
        @State private var editingColor = Color.blue
        @State private var playerMatches: [Match] = []

        private var currentPlayer: Player {
            cloudKitManager.players.first { $0.id == player.id } ?? player
        }

        var isCurrentUserProfile: Bool {
            currentPlayer.appleUserID == authManager.userID
        }

        var canDelete: Bool {
            !isCurrentUserProfile && currentPlayer.ownerID == authManager.userID
        }

        var body: some View {
            List {
                Section {
                    HStack {
                        if let photoData = currentPlayer.photoData,
                            let uiImage = UIImage(data: photoData)
                        {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 80, height: 80)
                                .clipShape(Circle())
                        } else {
                            PlayerInitialsView(
                                name: currentPlayer.name,
                                size: 80,
                                color: currentPlayer.color
                            )
                        }

                        Text(currentPlayer.name)
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical)
                }

                matchHistorySection(playerMatches)
            }
            .navigationTitle(currentPlayer.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Button("Edit") {
                    editingName = currentPlayer.name
                    editingColor = currentPlayer.color
                    showingEditSheet = true
                }
            }
            .sheet(isPresented: $showingEditSheet) {
                NavigationStack {
                    PlayerFormView(
                        name: $editingName,
                        color: $editingColor,
                        existingPhotoData: currentPlayer.photoData,
                        title: "Edit Player",
                        player: currentPlayer
                    )
                }
            }
            .task {
                // Fetch matches for this player
                if let games = try? await cloudKitManager.fetchGames() {
                    for game in games {
                        if let matches = try? await cloudKitManager.fetchMatches(for: game) {
                            playerMatches.append(
                                contentsOf: matches.filter { $0.playerIDs.contains(player.id) })
                        }
                    }
                }
            }
        }

        private func matchHistorySection(_ matches: [Match]) -> some View {
            Section("Match History") {
                if matches.isEmpty {
                    Text("No matches played")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(matches) { match in
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
