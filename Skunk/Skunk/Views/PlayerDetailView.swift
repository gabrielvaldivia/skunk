import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerDetailView: View {
        @Environment(\.dismiss) var dismiss
        @EnvironmentObject var authManager: AuthenticationManager
        let cloudKitManager: CloudKitManager
        private let playerId: String
        @State private var player: Player

        @State private var playerMatches: [Match] = []
        @State private var isLoading = false
        @State private var showingEditSheet = false
        @State private var editingName = ""
        @State private var editingColor = Color.blue
        @State private var loadingTask: Task<Void, Never>?

        init(player: Player, cloudKitManager: CloudKitManager = .shared) {
            self.playerId = player.id
            self._player = State(initialValue: player)
            self.cloudKitManager = cloudKitManager
        }

        var isCurrentUserProfile: Bool {
            player.appleUserID == authManager.userID
        }

        var canDelete: Bool {
            !isCurrentUserProfile && player.ownerID == authManager.userID
        }

        private func refreshPlayer() async {
            if let updatedPlayer = try? await cloudKitManager.fetchPlayer(id: playerId) {
                player = updatedPlayer
            }
        }

        private func loadPlayerData() async {
            guard !isLoading, !Task.isCancelled else { return }
            isLoading = true
            defer { isLoading = false }

            await refreshPlayer()

            do {
                print("🔵 PlayerDetailView: Starting to load player data")

                // First try to find matches in existing games
                var newMatches: [Match] = []

                // If we have games in cache, use those first
                if !cloudKitManager.games.isEmpty {
                    print("🔵 PlayerDetailView: Using cached games")
                    for game in cloudKitManager.games {
                        if let gameMatches = game.matches {
                            newMatches.append(
                                contentsOf: gameMatches.filter { $0.playerIDs.contains(player.id) })
                        }
                    }
                }

                // If we found matches in cache, use those
                if !newMatches.isEmpty {
                    print("🔵 PlayerDetailView: Found \(newMatches.count) matches in cache")
                    playerMatches = newMatches.sorted { $0.date > $1.date }
                    return
                }

                // Otherwise fetch games and matches
                print("🔵 PlayerDetailView: No matches in cache, fetching games")
                let games = try await cloudKitManager.fetchGames()
                guard !Task.isCancelled else { return }

                // Ensure we have all players loaded before fetching matches
                _ = try await cloudKitManager.fetchPlayers(forceRefresh: false)

                // Create a task group to fetch matches in parallel
                try await withThrowingTaskGroup(of: [Match].self) { group in
                    for game in games {
                        group.addTask {
                            guard !Task.isCancelled else { return [] }
                            if let matches = try? await cloudKitManager.fetchMatches(for: game) {
                                return matches.filter { $0.playerIDs.contains(player.id) }
                            }
                            return []
                        }
                    }

                    // Collect all matches
                    for try await matches in group {
                        newMatches.append(contentsOf: matches)
                    }
                }

                guard !Task.isCancelled else { return }
                print("🔵 PlayerDetailView: Found \(newMatches.count) matches from fetch")
                playerMatches = newMatches.sorted { $0.date > $1.date }
            } catch {
                print("🔵 PlayerDetailView: Error loading matches: \(error.localizedDescription)")
            }
        }

        var body: some View {
            List {
                PlayerInfoSection(player: player)
                matchHistorySection(playerMatches)

                if canDelete {
                    Section {
                        Button(role: .destructive) {
                            Task {
                                try? await cloudKitManager.deletePlayer(player)
                                dismiss()
                            }
                        } label: {
                            Text("Delete Player")
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .navigationTitle(player.name)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if isCurrentUserProfile {
                        Button {
                            editingName = player.name
                            editingColor = player.color
                            showingEditSheet = true
                        } label: {
                            Text("Edit")
                        }
                    }
                }
            }
            .sheet(
                isPresented: $showingEditSheet,
                onDismiss: {
                    Task {
                        await loadPlayerData()
                    }
                }
            ) {
                NavigationStack {
                    PlayerFormView(
                        name: $editingName,
                        color: $editingColor,
                        existingPhotoData: player.photoData,
                        title: "Edit Player",
                        player: player
                    )
                }
            }
            .task {
                if playerMatches.isEmpty {
                    await loadPlayerData()
                }
            }
            .refreshable {
                await loadPlayerData()
            }
            .onDisappear {
                loadingTask?.cancel()
                loadingTask = nil
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
