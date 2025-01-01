import Charts
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct GameNavigationDestinations: ViewModifier {
        func body(content: Content) -> some View {
            content
                .navigationDestination(for: Match.self) { match in
                    MatchDetailView(match: match)
                }
                .navigationDestination(for: Player.self) { player in
                    AsyncPlayerDetailView(player: player)
                }
        }
    }

    extension View {
        func gameNavigationDestinations() -> some View {
            modifier(GameNavigationDestinations())
        }
    }

    struct GameDetailView: View {
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        let game: Game
        @State private var showingNewMatch = false
        @State private var showingEditGame = false
        @State private var showingDeleteConfirmation = false
        @State private var matches: [Match] = []
        @State private var playerGroups: [PlayerGroup] = []
        @State private var selectedGroupId: String?
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false

        var body: some View {
            ZStack {
                if isLoading {
                    ProgressView()
                } else if matches.isEmpty {
                    VStack(spacing: 8) {
                        Text("No Matches")
                            .font(.headline)
                            .fontWeight(.semibold)
                        Text("Tap the button below to start a match")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    List {
                        // Game content here
                    }
                }

                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Button(action: { showingNewMatch.toggle() }) {
                            Text("New Match")
                                .font(.headline)
                                .foregroundColor(.white)
                                .padding(.horizontal, 24)
                                .padding(.vertical, 12)
                                .background(Color.blue)
                                .clipShape(RoundedRectangle(cornerRadius: 24))
                                .shadow(radius: 4, y: 2)
                        }
                        Spacer()
                    }
                    .padding(.bottom, 20)
                }
            }
            .navigationDestination(for: Match.self) { match in
                MatchDetailView(match: match)
            }
            .navigationDestination(for: Player.self) { player in
                AsyncPlayerDetailView(player: player)
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Button(action: { showingEditGame.toggle() }) {
                    Text("Edit")
                }
            }
            .sheet(isPresented: $showingNewMatch) {
                NewMatchView(
                    game: game,
                    onMatchSaved: { newMatch in
                        matches.insert(newMatch, at: 0)
                        Task {
                            await loadData()
                        }
                    }
                )
            }
            .task {
                print("🔵 GameDetailView: Initial task triggered")
                if matches.isEmpty {
                    await loadData()
                }
            }
            .refreshable {
                print("🔵 GameDetailView: Manual refresh triggered")
                await loadData()
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
        }

        private func loadData() async {
            isLoading = true
            do {
                // Load matches
                let loadedMatches = try await cloudKitManager.fetchMatches(for: game)
                print("🔵 GameDetailView: Loaded \(loadedMatches.count) matches")

                // Get all unique player IDs from matches
                let playerIDs = Set(loadedMatches.flatMap { $0.playerIDs })
                print("🔵 GameDetailView: Found \(playerIDs.count) unique players")

                // Find missing players
                let missingPlayerIDs = playerIDs.filter { id in
                    !cloudKitManager.players.contains { $0.id == id }
                }

                // Only fetch players again if we're missing some
                if !missingPlayerIDs.isEmpty {
                    print("🔵 GameDetailView: Fetching missing players")
                    _ = try await cloudKitManager.fetchPlayers(forceRefresh: true)
                }

                // Load player groups
                let groups = try await cloudKitManager.fetchPlayerGroups()

                matches = loadedMatches
                playerGroups = groups
            } catch {
                print("🔵 GameDetailView: Error loading data: \(error.localizedDescription)")
                self.error = error
                showingError = true
            }
            isLoading = false
            print("🔵 GameDetailView: Finished loadData()")
        }
    }

    struct PlayerAvatar: View {
        let player: Player
        var size: CGFloat = 40

        var body: some View {
            if let photoData = player.photoData,
                let uiImage = UIImage(data: photoData)
            {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: size, height: size)
                    .clipShape(Circle())
            } else {
                PlayerInitialsView(
                    name: player.name,
                    size: size,
                    color: player.color
                )
            }
        }
    }

    struct PieChartView: View {
        let winCounts: [(player: Player, count: Int)]
        let totalWins: Int

        private func startAngle(for index: Int) -> Double {
            let precedingWinCounts = winCounts[..<index]
            let ratios = precedingWinCounts.map { Double($0.count) / Double(totalWins) }
            let sum = ratios.reduce(0.0, +)
            return sum * 360.0
        }

        var body: some View {
            ZStack {
                ForEach(Array(winCounts.enumerated()), id: \.element.player.id) { index, entry in
                    let startDegrees = startAngle(for: index)
                    let ratio = Double(entry.count) / Double(totalWins)
                    let endDegrees = startDegrees + (ratio * 360.0)

                    Path { path in
                        path.move(to: .init(x: 75, y: 75))
                        path.addArc(
                            center: .init(x: 75, y: 75),
                            radius: 75,
                            startAngle: .degrees(startDegrees),
                            endAngle: .degrees(endDegrees),
                            clockwise: false)
                    }
                    .fill(entry.player.color)
                }
            }
            .frame(width: 150, height: 150)
        }
    }

    struct ActivityGridView: View {
        let matches: [Match]
        private let columns = 20
        private let weeks = 6

        private struct DayActivity: Identifiable {
            let id = UUID()
            let date: Date
            let count: Int
        }

        private var activities: [DayActivity] {
            let calendar = Calendar.current
            let endDate = calendar.startOfDay(for: Date())  // End of today
            let startDate = calendar.date(
                byAdding: .day, value: -(weeks * columns - 1), to: endDate)!  // Include today

            // Initialize all days with 0 count
            var dayActivities: [Date: Int] = [:]
            var currentDate = startDate

            // Only create exactly 4 rows worth of squares (4 * 16 = 64 days)
            let totalDays = weeks * columns
            for _ in 0..<totalDays {
                dayActivities[currentDate] = 0
                currentDate = calendar.date(byAdding: .day, value: 1, to: currentDate)!
            }

            // Count matches per day
            for match in matches {
                let matchDate = calendar.startOfDay(for: match.date)
                if matchDate >= startDate && matchDate <= endDate {
                    dayActivities[matchDate, default: 0] += 1
                }
            }

            // Convert to array and ensure we only have exactly 64 items
            return dayActivities.map { DayActivity(date: $0.key, count: $0.value) }
                .sorted { $0.date < $1.date }
                .prefix(weeks * columns)
                .map { $0 }
        }

        private func activityColor(_ count: Int) -> Color {
            if count == 0 { return Color.black.opacity(0.1) }
            if count < 3 { return Color.blue.opacity(0.3) }  // 1-3 matches
            if count < 6 { return Color.blue.opacity(0.7) }  // 3-6 matches
            return Color.blue.opacity(1)  // 6+ matches
        }

        var body: some View {
            VStack(alignment: .leading, spacing: 4) {
                LazyVGrid(
                    columns: Array(repeating: GridItem(.fixed(16), spacing: 2), count: columns),
                    spacing: 2
                ) {
                    ForEach(activities) { activity in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(activityColor(activity.count))
                            .frame(height: 16)
                    }
                }

                HStack {
                    Text("Less")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(0))
                        .frame(width: 16, height: 16)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(2))
                        .frame(width: 16, height: 16)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(4))
                        .frame(width: 16, height: 16)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(6))
                        .frame(width: 16, height: 16)
                    Text("More")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 4)
                .padding(.horizontal, 4)
            }
            .padding(10)
        }
    }

    struct LeaderboardRow: View {
        let rank: Int
        let players: [Player]
        let wins: Int

        init(rank: Int, player: Player, wins: Int) {
            self.rank = rank
            self.players = [player]
            self.wins = wins
        }

        init(rank: Int, players: [Player], wins: Int) {
            self.rank = rank
            self.players = players
            self.wins = wins
        }

        private var displayName: String {
            switch players.count {
            case 0:
                return "No players"
            case 1:
                return players[0].name
            case 2:
                return "\(players[0].name) & \(players[1].name)"
            default:
                let allButLast = players.dropLast().map { $0.name }.joined(separator: ", ")
                return "\(allButLast), & \(players.last!.name)"
            }
        }

        var body: some View {
            HStack {
                Text("#\(rank)")
                    .font(.headline)
                    .foregroundStyle(.secondary)
                    .frame(width: 32)

                VStack(alignment: .leading, spacing: 4) {
                    Text(displayName)
                        .font(.headline)
                    Text("\(wins) wins")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if players.count > 1 {
                    // Facepile for groups
                    HStack(spacing: -8) {
                        ForEach(players.prefix(3)) { player in
                            PlayerAvatar(player: player, size: 40)
                                .clipShape(Circle())
                                .overlay(
                                    Circle()
                                        .stroke(Color(.systemBackground), lineWidth: 2)
                                )
                        }
                        if players.count > 3 {
                            Text("+\(players.count - 3)")
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color(.systemGray5))
                                .clipShape(Capsule())
                        }
                    }
                } else if let player = players.first {
                    // Single avatar for individual players
                    PlayerAvatar(player: player, size: 40)
                        .clipShape(Circle())
                        .overlay(
                            Circle()
                                .stroke(Color.black.opacity(0.1), lineWidth: 1)
                        )
                }
            }
            .padding(.vertical, 8)
        }
    }
#endif
