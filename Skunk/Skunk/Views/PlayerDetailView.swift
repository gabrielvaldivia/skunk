import Charts
import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct StatsGridView: View {
        private let stats:
            (
                played: Int,
                won: Int,
                rate: Int,
                currentStreak: Int,
                maxStreak: Int,
                recentRate: Int
            )

        init(matches: [Match], playerId: String) {
            let played = matches.count
            let won = matches.filter { $0.winnerID == playerId }.count
            let rate = played > 0 ? Int(Double(won) / Double(played) * 100) : 0

            // Calculate streaks
            var currentStreak = 0
            var maxStreak = 0
            let sortedMatches = matches.sorted(by: { $0.date < $1.date })

            for match in sortedMatches {
                if match.winnerID == playerId {
                    currentStreak += 1
                    maxStreak = max(maxStreak, currentStreak)
                } else {
                    currentStreak = 0
                }
            }

            // Calculate recent performance (last 10 matches)
            let recentMatches = Array(matches.sorted(by: { $0.date > $1.date }).prefix(10))
            let recentWins = recentMatches.filter { $0.winnerID == playerId }.count
            let recentRate =
                recentMatches.isEmpty
                ? 0 : Int(Double(recentWins) / Double(recentMatches.count) * 100)

            stats = (played, won, rate, currentStreak, maxStreak, recentRate)
        }

        var body: some View {
            Section {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 20) {
                    StatItemView(value: "\(stats.played)", label: "Matches Played")
                    StatItemView(value: "\(stats.won)", label: "Matches Won")
                    StatItemView(value: "\(stats.rate)%", label: "Overall Win Rate")
                    StatItemView(value: "\(stats.recentRate)%", label: "Recent Win Rate")
                    StatItemView(value: "\(stats.currentStreak)", label: "Current Streak")
                    StatItemView(value: "\(stats.maxStreak)", label: "Longest Streak")
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

    struct WinRateChartView: View {
        private struct WinRatePoint: Identifiable {
            let id = UUID()
            let date: Date
            let rate: Double
            let totalGames: Int
        }

        private let dataPoints: [WinRatePoint]

        init(matches: [Match], playerId: String) {
            let sortedMatches = matches.sorted { $0.date < $1.date }
            var points: [WinRatePoint] = []
            var wins = 0
            var total = 0

            for match in sortedMatches {
                total += 1
                if match.winnerID == playerId {
                    wins += 1
                }
                let rate = Double(wins) / Double(total) * 100.0
                points.append(WinRatePoint(date: match.date, rate: rate, totalGames: total))
            }

            self.dataPoints = points
        }

        var body: some View {
            Section("Win Rate Over Time") {
                if dataPoints.isEmpty {
                    Text("No matches played")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical)
                } else {
                    Chart(dataPoints) { point in
                        LineMark(
                            x: .value("Date", point.date),
                            y: .value("Win Rate", point.rate)
                        )
                        .foregroundStyle(Color.blue.gradient)
                        .lineStyle(StrokeStyle(lineWidth: 2))

                        AreaMark(
                            x: .value("Date", point.date),
                            y: .value("Win Rate", point.rate)
                        )
                        .foregroundStyle(Color.blue.opacity(0.1).gradient)
                    }
                    .chartYAxis {
                        AxisMarks(position: .leading) { value in
                            AxisValueLabel {
                                if let rate = value.as(Double.self) {
                                    Text("\(Int(rate))%")
                                }
                            }
                        }
                    }
                    .chartXAxis {
                        AxisMarks(values: .stride(by: .month)) { value in
                            AxisValueLabel {
                                if let date = value.as(Date.self) {
                                    Text(date.formatted(.dateTime.month(.abbreviated)))
                                }
                            }
                        }
                    }
                    .frame(height: 200)
                    .padding(.vertical)
                }
            }
        }
    }

    struct FrequentOpponentsView: View {
        private struct OpponentStats: Identifiable {
            let id: String
            let player: Player
            let matchesPlayed: Int
            let wins: Int
            let winRate: Int
        }

        private let opponents: [OpponentStats]

        init(matches: [Match], playerId: String, cloudKitManager: CloudKitManager) {
            // Group matches by opponent
            var opponentMatches: [String: [Match]] = [:]
            var opponentWins: [String: Int] = [:]

            for match in matches {
                // Find opponent ID (the other player in the match)
                let opponentId = match.playerIDs.first { $0 != playerId } ?? ""
                if !opponentId.isEmpty {
                    opponentMatches[opponentId, default: []].append(match)
                    if match.winnerID == playerId {
                        opponentWins[opponentId, default: 0] += 1
                    }
                }
            }

            // Convert to OpponentStats and sort by number of matches
            opponents = opponentMatches.compactMap { opponentId, matches in
                guard let player = cloudKitManager.players.first(where: { $0.id == opponentId })
                else {
                    return nil
                }
                let wins = opponentWins[opponentId] ?? 0
                let winRate = Int(Double(wins) / Double(matches.count) * 100)
                return OpponentStats(
                    id: opponentId,
                    player: player,
                    matchesPlayed: matches.count,
                    wins: wins,
                    winRate: winRate
                )
            }
            .sorted { $0.matchesPlayed > $1.matchesPlayed }
        }

        var body: some View {
            Section("Most Frequent Opponents") {
                if opponents.isEmpty {
                    Text("No matches played")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(Array(opponents.prefix(5))) { opponent in
                        NavigationLink {
                            PlayerDetailView(player: opponent.player)
                        } label: {
                            HStack {
                                PlayerAvatar(player: opponent.player, size: 36)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(opponent.player.name)
                                        .font(.headline)
                                    Text(
                                        "\(opponent.matchesPlayed) matches • \(opponent.winRate)% win rate"
                                    )
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
    }

    struct FrequentGamesView: View {
        private struct GameStats: Identifiable {
            let id: String
            let game: Game
            let matchesPlayed: Int
            let wins: Int
            let winRate: Int
        }

        private let games: [GameStats]

        init(matches: [Match], playerId: String) {
            // Group matches by game
            var gameMatches: [String: [Match]] = [:]
            var gameWins: [String: Int] = [:]
            var uniqueGames: [String: Game] = [:]

            for match in matches {
                if let game = match.game {
                    gameMatches[game.id, default: []].append(match)
                    uniqueGames[game.id] = game
                    if match.winnerID == playerId {
                        gameWins[game.id, default: 0] += 1
                    }
                }
            }

            // Convert to GameStats and sort by number of matches
            games = gameMatches.compactMap { gameId, matches in
                guard let game = uniqueGames[gameId] else { return nil }
                let wins = gameWins[gameId] ?? 0
                let winRate = Int(Double(wins) / Double(matches.count) * 100)
                return GameStats(
                    id: gameId,
                    game: game,
                    matchesPlayed: matches.count,
                    wins: wins,
                    winRate: winRate
                )
            }
            .sorted { $0.matchesPlayed > $1.matchesPlayed }
        }

        var body: some View {
            Section("Most Played Games") {
                if games.isEmpty {
                    Text("No matches played")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(Array(games.prefix(5))) { gameStats in
                        NavigationLink {
                            GameDetailView(game: gameStats.game)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(gameStats.game.title)
                                    .font(.headline)
                                Text(
                                    "\(gameStats.matchesPlayed) matches • \(gameStats.winRate)% win rate"
                                )
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
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
                    WinRateChartView(matches: playerMatches, playerId: playerId)
                    FrequentOpponentsView(
                        matches: playerMatches, playerId: playerId, cloudKitManager: cloudKitManager
                    )
                    FrequentGamesView(matches: playerMatches, playerId: playerId)
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
