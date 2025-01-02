import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct StatsGridView: View {
        private let stats: (played: Int, won: Int, rate: Int, streak: Int)

        init(matches: [Match], playerId: String) {
            let played = matches.count
            let won = matches.filter { $0.winnerID == playerId }.count
            let rate = played > 0 ? Int(Double(won) / Double(played) * 100) : 0

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

            stats = (played, won, rate, maxStreak)
        }

        var body: some View {
            Section {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 20) {
                    StatItemView(value: "\(stats.played)", label: "Matches Played")
                    StatItemView(value: "\(stats.won)", label: "Matches Won")
                    StatItemView(value: "\(stats.rate)%", label: "Win Rate")
                    StatItemView(value: "\(stats.streak)", label: "Longest Streak")
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

    struct PlayerHeaderContent: View {
        let player: Player

        var body: some View {
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
            }
            .frame(maxWidth: .infinity)
            .listRowBackground(Color.clear)
        }
    }

    struct PlayerDetailView: View {
        @Environment(\.dismiss) var dismiss
        @EnvironmentObject var authManager: AuthenticationManager
        @ObservedObject var cloudKitManager: CloudKitManager
        private let playerId: String

        private var player: Player? {
            cloudKitManager.players.first(where: { $0.id == playerId })
        }

        private enum LoadingState {
            case idle
            case loading
            case loaded
            case error(String)
        }

        @State private var playerMatches: [Match] = []
        @State private var loadingState: LoadingState = .idle
        @State private var showingEditSheet = false
        @State private var editingName = ""
        @State private var editingColor = Color.blue

        init(player: Player, cloudKitManager: CloudKitManager = .shared) {
            print("🔵 PlayerDetailView: Initializing with player: \(player.name)")
            self.playerId = player.id
            self.cloudKitManager = cloudKitManager
        }

        var isCurrentUserProfile: Bool {
            player?.appleUserID == authManager.userID
        }

        private func refreshPlayer() async {
            print("🔵 PlayerDetailView: Starting refreshPlayer for ID: \(playerId)")
            if let updatedPlayer = try? await cloudKitManager.fetchPlayer(id: playerId) {
                print("🔵 PlayerDetailView: Got updated player: \(updatedPlayer.name)")
            }
        }

        private func fetchMatchesFromGames(_ games: [Game]) async throws -> [Match] {
            try await withThrowingTaskGroup(of: [Match].self) { group in
                for game in games {
                    group.addTask {
                        guard !Task.isCancelled else { return [] }
                        return (try? await cloudKitManager.fetchMatches(for: game))?.filter {
                            $0.playerIDs.contains(playerId)
                        } ?? []
                    }
                }

                return try await group.reduce(into: []) { $0.append(contentsOf: $1) }

            }
        }

        private func loadPlayerData() async {
            guard case .idle = loadingState else { return }
            loadingState = .loading

            do {
                await refreshPlayer()

                // Try direct fetch first
                if let matches = try? await cloudKitManager.fetchRecentMatches(
                    forPlayer: playerId, limit: 50)
                {
                    playerMatches = matches.sorted { $0.date > $1.date }
                    loadingState = .loaded
                    return
                }

                // Fallback to parallel game fetching
                let games = try await cloudKitManager.fetchGames()
                let matches = try await fetchMatchesFromGames(games)
                playerMatches = matches.sorted { $0.date > $1.date }
                loadingState = .loaded
            } catch {
                loadingState = .error(error.localizedDescription)
            }
        }

        private var playerHeaderSection: some View {
            Section {
                if let currentPlayer = player {
                    PlayerHeaderContent(player: currentPlayer)
                }
            }
        }

        private var matchesSection: some View {
            Group {
                if !playerMatches.isEmpty {
                    StatsGridView(matches: playerMatches, playerId: playerId)
                    matchHistorySection(playerMatches)
                }
            }
        }

        private var loadingSection: some View {
            Section {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
            }
        }

        private var editSheet: some View {
            Group {
                if let currentPlayer = player {
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

        var body: some View {
            List {
                if let currentPlayer = player {
                    playerHeaderSection

                    switch loadingState {
                    case .loading:
                        loadingSection
                    case .loaded, .idle:
                        matchesSection
                    case .error(let message):
                        Section {
                            Text("Error: \(message)")
                                .foregroundStyle(.red)
                        }
                    }
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if let currentPlayer = player,
                        isCurrentUserProfile
                            || (currentPlayer.ownerID == authManager.userID
                                && currentPlayer.appleUserID == nil)
                    {
                        Button {
                            editingName = currentPlayer.name
                            editingColor = currentPlayer.color
                            showingEditSheet = true
                        } label: {
                            Text("Edit")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingEditSheet) {
                print("🔵 PlayerDetailView: Edit sheet dismissed")
                Task {
                    print("🔵 PlayerDetailView: Starting post-edit refresh")
                    loadingState = .idle
                    await loadPlayerData()
                }
            } content: {
                editSheet
            }
            .task {
                print("🔵 PlayerDetailView: View appeared, loading data")
                await loadPlayerData()
            }
            .onChange(of: cloudKitManager.players) {
                print("🔵 PlayerDetailView: CloudKitManager players changed")
                Task {
                    loadingState = .idle
                    await loadPlayerData()
                }
            }
            .refreshable {
                loadingState = .idle
                await loadPlayerData()
            }
        }
    }
#endif
