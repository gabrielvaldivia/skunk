import Charts
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct GameDetailView: View {
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        let game: Game
        @State private var showingNewMatch = false
        @State private var showingEditGame = false
        @State private var showingDeleteConfirmation = false
        @State private var matches: [Match] = []
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false

        private var winCounts: [(player: Player, count: Int)] {
            // Get all players who have participated in matches
            var allPlayers = Set<Player>()
            var counts: [Player: Int] = [:]

            // First collect all players who have participated
            for match in matches {
                for playerID in match.playerIDs {
                    if let player = cloudKitManager.players.first(where: { $0.id == playerID }) {
                        allPlayers.insert(player)
                    }
                }
            }

            // Then count wins
            for match in matches {
                if let winnerID = match.winnerID,
                    let winner = cloudKitManager.players.first(where: { $0.id == winnerID })
                {
                    counts[winner, default: 0] += 1
                }
            }

            // Ensure all players are in counts, even with 0 wins
            for player in allPlayers {
                if counts[player] == nil {
                    counts[player] = 0
                }
            }

            // Convert to array of tuples
            var pairs: [(player: Player, count: Int)] = []
            for (player, count) in counts {
                pairs.append((player: player, count: count))
            }

            // Sort by count (highest first), then by name for ties
            pairs.sort { pair1, pair2 in
                if pair1.count != pair2.count {
                    return pair1.count > pair2.count
                }
                return pair1.player.name < pair2.player.name
            }
            return pairs
        }

        private var totalWins: Int {
            winCounts.reduce(0) { $0 + $1.count }
        }

        private func calculateWinPercentage(count: Int) -> Int {
            guard totalWins > 0 else { return 0 }
            let percentage = Double(count) / Double(totalWins) * 100.0
            return Int(percentage)
        }

        private func playerStatsView(_ entry: (player: Player, count: Int)) -> some View {
            HStack {
                Circle()
                    .fill(entry.player.color)
                    .frame(width: 12, height: 12)
                Text(entry.player.name)
                Spacer()
                Text("\(calculateWinPercentage(count: entry.count))%")
                    .foregroundStyle(.secondary)
            }
        }

        private func playerRow(_ index: Int, _ entry: (player: Player, count: Int)) -> some View {
            NavigationLink {
                PlayerDetailView(player: entry.player)
            } label: {
                HStack(spacing: 16) {
                    Text("#\(index + 1)")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                        .frame(width: 40)

                    PlayerAvatar(player: entry.player)

                    VStack(alignment: .leading) {
                        Text(entry.player.name)
                            .font(.headline)
                    }

                    Spacer()

                    Text("\(entry.count) wins")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }

        private func winDistributionSection() -> some View {
            Section("Win Distribution") {
                VStack(alignment: .center, spacing: 16) {
                    if totalWins > 0 {
                        PieChartView(winCounts: winCounts, totalWins: totalWins)
                            .padding(.vertical)
                    }

                    ForEach(winCounts, id: \.player.id) { entry in
                        playerStatsView(entry)
                    }
                }
                .padding(20)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .frame(maxWidth: .infinity)
                .listRowInsets(EdgeInsets())
            }
        }

        private func matchHistorySection(_ matches: [Match]) -> some View {
            Section("Match History") {
                ForEach(matches.sorted { $0.date > $1.date }) { match in
                    NavigationLink {
                        MatchDetailView(match: match)
                    } label: {
                        MatchRow(match: match, hideGameTitle: true)
                    }
                }
            }
        }

        private func activitySection(_ matches: [Match]) -> some View {
            Section("Activity") {
                ActivityGridView(matches: Array(matches))
                    .listRowInsets(EdgeInsets())
            }
        }

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
                        Section("Leaderboard") {
                            ForEach(Array(winCounts.enumerated()), id: \.element.player.id) {
                                index, entry in
                                playerRow(index, entry)
                            }
                        }

                        if totalWins > 0 {
                            winDistributionSection()
                        }
                        activitySection(matches)
                        matchHistorySection(matches)
                    }
                }

                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Button(action: { showingNewMatch.toggle() }) {
                            Image(systemName: "plus")
                                .font(.title2.weight(.semibold))
                                .foregroundColor(.white)
                                .frame(width: 60, height: 60)
                                .background(Color.blue)
                                .clipShape(Circle())
                                .shadow(radius: 4, y: 2)
                        }
                        Spacer()
                    }
                    .padding(.bottom, 20)
                }
            }
            .navigationTitle(game.title)
            .toolbar {
                Button(action: { showingEditGame.toggle() }) {
                    Text("Edit")
                }
            }
            .sheet(isPresented: $showingNewMatch) {
                NewMatchView(
                    game: game,
                    onMatchSaved: { newMatch in
                        print("🔵 GameDetailView: New match saved, updating local state")
                        matches.insert(newMatch, at: 0)  // Add to beginning since it's newest
                        Task {
                            try? await Task.sleep(for: .seconds(1))  // Give CloudKit time to propagate
                            await loadMatches()  // Then refresh to ensure consistency
                        }
                    })
            }
            .onChange(of: showingNewMatch) { isShowing in
                print("🔵 GameDetailView: NewMatch sheet \(isShowing ? "opened" : "closed")")
                if !isShowing {
                    Task {
                        await loadMatches()
                    }
                }
            }
            .sheet(isPresented: $showingEditGame) {
                EditGameView(game: game)
            }
            .navigationDestination(for: Match.self) { match in
                MatchDetailView(match: match)
            }
            .navigationDestination(for: Player.self) { player in
                PlayerDetailView(player: player)
            }
            .task {
                print("🔵 GameDetailView: Initial task triggered")
                await loadMatches()
            }
            .refreshable {
                print("🔵 GameDetailView: Manual refresh triggered")
                await loadMatches()
            }
            .onAppear {
                print("🔵 GameDetailView: View appeared")
                Task {
                    await loadMatches()
                }
            }
            .onChange(of: cloudKitManager.games) { _ in
                print("🔵 GameDetailView: CloudKitManager games array changed")
                if let updatedGame = cloudKitManager.games.first(where: { $0.id == game.id }) {
                    print("🔵 GameDetailView: Found updated game: \(updatedGame.id)")
                    if let updatedMatches = updatedGame.matches {
                        print(
                            "🔵 GameDetailView: Updating matches array with \(updatedMatches.count) matches"
                        )
                        matches = updatedMatches
                    } else {
                        print("🔵 GameDetailView: Updated game has no matches array")
                    }
                } else {
                    print("🔵 GameDetailView: Could not find updated game in CloudKitManager")
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
            .alert("Delete Game", isPresented: $showingDeleteConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    Task {
                        do {
                            try await cloudKitManager.deleteGame(game)
                            dismiss()
                        } catch {
                            self.error = error
                            showingError = true
                        }
                    }
                }
            } message: {
                Text("Are you sure you want to delete this game? This action cannot be undone.")
            }
        }

        private func loadMatches() async {
            print("🔵 GameDetailView: Starting loadMatches()")
            isLoading = true
            do {
                // First fetch players to ensure they're available
                print("🔵 GameDetailView: Fetching players")
                _ = try await cloudKitManager.fetchPlayers()

                let loadedMatches = try await cloudKitManager.fetchMatches(for: game)
                print("🔵 GameDetailView: Successfully loaded \(loadedMatches.count) matches")
                matches = loadedMatches
            } catch {
                print("🔵 GameDetailView: Error loading matches: \(error.localizedDescription)")
                self.error = error
                showingError = true
            }
            isLoading = false
            print("🔵 GameDetailView: Finished loadMatches()")
        }
    }

    struct PlayerAvatar: View {
        let player: Player

        var body: some View {
            if let photoData = player.photoData,
                let uiImage = UIImage(data: photoData)
            {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 40, height: 40)
                    .clipShape(Circle())
            } else {
                PlayerInitialsView(
                    name: player.name,
                    size: 40,
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
        private let columns = 16
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
                    columns: Array(repeating: GridItem(.fixed(20), spacing: 2), count: columns),
                    spacing: 2
                ) {
                    ForEach(activities) { activity in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(activityColor(activity.count))
                            .frame(height: 20)
                    }
                }
                .padding(.top, 10)

                HStack {
                    Text("Less")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(0))
                        .frame(width: 20, height: 20)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(2))
                        .frame(width: 20, height: 20)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(4))
                        .frame(width: 20, height: 20)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(6))
                        .frame(width: 20, height: 20)
                    Text("More")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 4)
                .padding(.horizontal)
                .padding(.bottom, 10)
            }
        }
    }
#endif
