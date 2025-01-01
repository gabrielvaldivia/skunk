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
        @ObservedObject var cloudKitManager: CloudKitManager
        private let playerId: String
        private var player: Player {
            cloudKitManager.players.first(where: { $0.id == playerId })
                ?? cloudKitManager.players[0]
        }

        @State private var playerMatches: [Match] = []
        @State private var isLoading = false
        @State private var showingEditSheet = false
        @State private var editingName = ""
        @State private var editingColor = Color.blue
        @State private var loadingTask: Task<Void, Never>?
        @State private var lastRefreshTime: Date = .distantPast
        private let cacheTimeout: TimeInterval = 30  // Refresh cache after 30 seconds

        init(player: Player, cloudKitManager: CloudKitManager = .shared) {
            print("🔵 PlayerDetailView: Initializing with player: \(player.name)")
            self.playerId = player.id
            self.cloudKitManager = cloudKitManager
        }

        var isCurrentUserProfile: Bool {
            player.appleUserID == authManager.userID
        }

        private func refreshPlayer() async {
            print("🔵 PlayerDetailView: Starting refreshPlayer for ID: \(playerId)")
            if let updatedPlayer = try? await cloudKitManager.fetchPlayer(id: playerId) {
                print("🔵 PlayerDetailView: Got updated player: \(updatedPlayer.name)")
                print("🔵 PlayerDetailView: Updated player state")
            } else {
                print("🔵 PlayerDetailView: Failed to fetch updated player")
            }
        }

        private func loadPlayerData() async {
            guard !isLoading else { return }

            isLoading = true
            defer { isLoading = false }

            do {
                print("🔵 PlayerDetailView: Starting to load player data")
                await refreshPlayer()

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
                    return
                }

                // Otherwise fetch games and matches
                print("🔵 PlayerDetailView: No matches in cache, fetching games")
                let games = try await cloudKitManager.fetchGames()
                guard !Task.isCancelled else { return }

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
            } catch {
                print("🔵 PlayerDetailView: Error loading matches: \(error.localizedDescription)")
            }
        }

        var body: some View {
            List {
                Section {
                    VStack(spacing: 12) {
                        if let photoData = player.photoData,
                            let uiImage = UIImage(data: photoData)
                        {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 120, height: 120)
                                .clipShape(Circle())
                        } else {
                            PlayerInitialsView(
                                name: player.name,
                                size: 120,
                                color: player.color
                            )
                        }

                        Text(player.name)
                            .font(.system(size: 28))
                            .fontWeight(.bold)
                            .onChange(of: player.name) { oldValue, newValue in
                                print(
                                    "🔵 PlayerDetailView: Player name changed in view from \(oldValue) to \(newValue)"
                                )
                            }
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }

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
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if isCurrentUserProfile
                        || (player.ownerID == authManager.userID && player.appleUserID == nil)
                    {
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
                    print("🔵 PlayerDetailView: Edit sheet dismissed")
                    Task {
                        print("🔵 PlayerDetailView: Starting post-edit refresh")
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
                print("🔵 PlayerDetailView: View appeared, loading data")
                await loadPlayerData()
            }
            .onChange(of: cloudKitManager.players) { _, _ in
                print("🔵 PlayerDetailView: CloudKitManager players changed")
                Task {
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
