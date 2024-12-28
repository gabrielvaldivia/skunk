import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct StatsGridView: View {
        let matches: [Match]
        let playerId: String

        private var matchesPlayed: Int {
            matches.count
        }

        private var matchesWon: Int {
            matches.filter { $0.winnerID == playerId }.count
        }

        private var winRate: Double {
            guard matchesPlayed > 0 else { return 0 }
            return Double(matchesWon) / Double(matchesPlayed) * 100
        }

        private var longestStreak: Int {
            var currentStreak = 0
            var maxStreak = 0

            for match in matches.sorted(by: { $0.date < $1.date }) {
                if match.winnerID == playerId {
                    currentStreak += 1
                    maxStreak = max(maxStreak, currentStreak)
                } else {
                    currentStreak = 0
                }
            }

            return maxStreak
        }

        var body: some View {
            Section {
                LazyVGrid(
                    columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                    ], spacing: 20
                ) {
                    StatItemView(value: "\(matchesPlayed)", label: "Matches Played")
                    StatItemView(value: "\(matchesWon)", label: "Matches Won")
                    StatItemView(value: "\(Int(winRate))%", label: "Win Rate")
                    StatItemView(value: "\(longestStreak)", label: "Longest Streak")
                }
                .padding(.vertical)
            }
        }
    }

    struct StatItemView: View {
        let value: String
        let label: String

        var body: some View {
            VStack(spacing: 4) {
                Text(value)
                    .font(.title)
                    .fontWeight(.bold)
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
        }
    }

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
        @State private var lastRefreshTime: Date = .distantPast
        private let cacheTimeout: TimeInterval = 30  // Refresh cache after 30 seconds

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
            guard !isLoading else { return }

            // Check if we have cached data and it's still fresh
            let now = Date()
            if let cachedMatches = cloudKitManager.getPlayerMatches(playerId),
                now.timeIntervalSince(lastRefreshTime) < cacheTimeout
            {
                playerMatches = cachedMatches
                return
            }

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
                    newMatches = newMatches.sorted { $0.date > $1.date }
                    playerMatches = newMatches
                    cloudKitManager.cachePlayerMatches(newMatches, for: playerId)
                    lastRefreshTime = now
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
                newMatches = newMatches.sorted { $0.date > $1.date }
                playerMatches = newMatches
                cloudKitManager.cachePlayerMatches(newMatches, for: playerId)
                lastRefreshTime = now
            } catch {
                print("🔵 PlayerDetailView: Error loading matches: \(error.localizedDescription)")
            }
        }

        var body: some View {
            List {
                PlayerInfoSection(player: player)

                if isLoading {
                    Section {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                    }
                } else {
                    if !playerMatches.isEmpty {
                        StatsGridView(matches: playerMatches, playerId: player.id)
                    }
                    matchHistorySection(playerMatches)
                }

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
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
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
