import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerDetailView: View {
        @EnvironmentObject var cloudKitManager: CloudKitManager
        @EnvironmentObject var authManager: AuthenticationManager
        @Environment(\.dismiss) var dismiss
        @State private var updatedPlayer: Player
        @State private var playerMatches: [Match] = []
        @State private var isLoading = false
        @State private var showingEditSheet = false
        @State private var editingName = ""
        @State private var editingColor = Color.blue
        @State private var loadingTask: Task<Void, Never>?

        let player: Player

        init(player: Player) {
            self.player = player
            _updatedPlayer = State(initialValue: player)
        }

        var isCurrentUserProfile: Bool {
            updatedPlayer.appleUserID == authManager.userID
        }

        var canDelete: Bool {
            !isCurrentUserProfile && updatedPlayer.ownerID == authManager.userID
        }

        var body: some View {
            List {
                PlayerInfoSection(player: updatedPlayer)
                matchHistorySection(playerMatches)

                if canDelete {
                    Section {
                        Button(role: .destructive) {
                            Task {
                                try? await cloudKitManager.deletePlayer(updatedPlayer)
                                dismiss()
                            }
                        } label: {
                            Text("Delete Player")
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .navigationTitle(updatedPlayer.name)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if isCurrentUserProfile {
                        Button {
                            editingName = updatedPlayer.name
                            editingColor = updatedPlayer.color
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
                        name: $editingName,
                        color: $editingColor,
                        existingPhotoData: updatedPlayer.photoData,
                        title: "Edit Player",
                        player: player
                    )
                }
            }
            .task {
                // Cancel any existing loading task
                loadingTask?.cancel()

                // Create a new loading task
                loadingTask = Task {
                    await loadPlayerData()
                }
            }
            .onDisappear {
                // Cancel the loading task when view disappears
                loadingTask?.cancel()
                loadingTask = nil
            }
        }

        private func loadPlayerData() async {
            guard !isLoading, !Task.isCancelled else { return }
            isLoading = true
            defer { isLoading = false }

            // Update player data from local cache only
            if let refreshedPlayer = cloudKitManager.players.first(where: { $0.id == player.id }) {
                updatedPlayer = refreshedPlayer
            }

            // Fetch matches only once
            do {
                let games = try await cloudKitManager.fetchGames()
                guard !Task.isCancelled else { return }

                var newMatches: [Match] = []
                for game in games {
                    guard !Task.isCancelled else { return }
                    if let matches = try? await cloudKitManager.fetchMatches(for: game) {
                        newMatches.append(
                            contentsOf: matches.filter { $0.playerIDs.contains(player.id) })
                    }
                }

                guard !Task.isCancelled else { return }
                playerMatches = newMatches.sorted { $0.date > $1.date }
            } catch {
                print("Error loading matches: \(error.localizedDescription)")
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
