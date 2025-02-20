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
        @State private var playerGroups: [PlayerGroup] = []
        @State private var selectedGroupId: String?
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false

        private var filteredMatches: [Match] {
            if let groupId = selectedGroupId,
                let group = playerGroups.first(where: { $0.id == groupId })
            {
                return matches.filter { match in
                    Set(match.playerIDs) == Set(group.playerIDs)
                }
            }
            return matches
        }

        private var activePlayerGroups: [PlayerGroup] {
            playerGroups.filter { group in
                matches.contains { match in
                    Set(match.playerIDs) == Set(group.playerIDs)
                }
            }
        }

        private var winCounts: [(player: Player, count: Int)] {
            var counts: [(player: Player, count: Int)] = []
            for match in filteredMatches {
                if let winnerID = match.winnerID,
                    let winner = cloudKitManager.getPlayer(id: winnerID)
                {
                    if let index = counts.firstIndex(where: { $0.player.id == winner.id }) {
                        counts[index].count += 1
                    } else {
                        counts.append((player: winner, count: 1))
                    }
                }
            }
            counts.sort { $0.count > $1.count }
            return counts
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
            LeaderboardRow(rank: index + 1, player: entry.player, wins: entry.count)
        }

        private var groupedWinCounts: [(rank: Int, players: [Player], wins: Int)] {
            var result: [(rank: Int, players: [Player], wins: Int)] = []
            var currentRank = 1

            // Group players by win count
            Dictionary(grouping: winCounts, by: { $0.count })
                .sorted { $0.key > $1.key }  // Sort by wins (descending)
                .forEach { wins, entries in
                    let players = entries.map { $0.player }
                        .sorted { $0.name < $1.name }  // Sort players by name within same win count
                    result.append((rank: currentRank, players: players, wins: wins))
                    currentRank += 1
                }

            return result
        }

        private var leaderboardSection: some View {
            Section("Leaderboard") {
                ForEach(groupedWinCounts, id: \.rank) { group in
                    LeaderboardRow(rank: group.rank, players: group.players, wins: group.wins)
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
                        Section {
                            VStack(spacing: 12) {
                                Text(game.title)
                                    .font(.system(size: 40))
                                    .fontWeight(.bold)
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .multilineTextAlignment(.center)

                                if activePlayerGroups.count > 1 {
                                    Menu {
                                        Button("All Players") {
                                            selectedGroupId = nil
                                        }
                                        ForEach(activePlayerGroups) { group in
                                            Button(group.name) {
                                                selectedGroupId = group.id
                                            }
                                        }
                                    } label: {
                                        HStack {
                                            Text(
                                                selectedGroupId.flatMap { id in
                                                    activePlayerGroups.first { $0.id == id }?.name
                                                } ?? "All Players")
                                            Image(systemName: "chevron.up.chevron.down")
                                                .imageScale(.small)
                                        }
                                        .foregroundStyle(.blue)
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .listRowBackground(Color.clear)
                        }

                        leaderboardSection

                        if totalWins > 0 {
                            winDistributionSection()
                        }
                        activitySection(filteredMatches)
                        matchHistorySection(filteredMatches)
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
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Button(action: { showingEditGame.toggle() }) {
                    Text("Edit")
                }
            }
            .sheet(isPresented: $showingNewMatch) {
                if let groupId = selectedGroupId,
                    let group = playerGroups.first(where: { $0.id == groupId })
                {
                    NewMatchView(
                        game: game,
                        defaultPlayerIDs: group.playerIDs,
                        onMatchSaved: { newMatch in
                            print("🔵 GameDetailView: New match saved, updating local state")
                            matches.insert(newMatch, at: 0)  // Add to beginning since it's newest

                            // Create or find player group for this match
                            Task {
                                do {
                                    let playerNames = newMatch.playerIDs.compactMap { id in
                                        cloudKitManager.getPlayer(id: id)?.name
                                    }
                                    let groupName = playerNames.joined(separator: ", ")
                                    _ = try await cloudKitManager.findOrCreatePlayerGroup(
                                        for: newMatch.playerIDs,
                                        suggestedName: groupName
                                    )
                                    try? await Task.sleep(for: .seconds(1))  // Give CloudKit time to propagate
                                    await loadData()  // Then refresh to ensure consistency
                                } catch {
                                    self.error = error
                                    showingError = true
                                }
                            }
                        }
                    )
                } else {
                    NewMatchView(
                        game: game,
                        onMatchSaved: { newMatch in
                            print("🔵 GameDetailView: New match saved, updating local state")
                            matches.insert(newMatch, at: 0)  // Add to beginning since it's newest

                            // Create or find player group for this match
                            Task {
                                do {
                                    let playerNames = newMatch.playerIDs.compactMap { id in
                                        cloudKitManager.getPlayer(id: id)?.name
                                    }
                                    let groupName = playerNames.joined(separator: ", ")
                                    _ = try await cloudKitManager.findOrCreatePlayerGroup(
                                        for: newMatch.playerIDs,
                                        suggestedName: groupName
                                    )
                                    try? await Task.sleep(for: .seconds(1))  // Give CloudKit time to propagate
                                    await loadData()  // Then refresh to ensure consistency
                                } catch {
                                    self.error = error
                                    showingError = true
                                }
                            }
                        }
                    )
                }
            }
            .sheet(isPresented: $showingEditGame) {
                EditGameView(game: game) {
                    Task {
                        // First dismiss the views
                        dismiss()

                        // Then force a fresh fetch with cache clearing
                        try? await Task.sleep(for: .seconds(1))  // Give CloudKit time to propagate
                        try? await cloudKitManager.fetchGames(forceRefresh: true)
                    }
                }
            }
            .navigationDestination(for: Match.self) { match in
                MatchDetailView(match: match)
            }
            .navigationDestination(for: Player.self) { player in
                PlayerDetailView(player: player)
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
        private let tileSize: CGFloat = 14
        private let spacing: CGFloat = 3

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
                    columns: Array(
                        repeating: GridItem(.fixed(tileSize), spacing: spacing), count: columns),
                    spacing: spacing
                ) {
                    ForEach(activities) { activity in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(activityColor(activity.count))
                            .frame(height: tileSize)
                    }
                }

                HStack {
                    Text("Less")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(0))
                        .frame(width: tileSize, height: tileSize)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(2))
                        .frame(width: tileSize, height: tileSize)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(4))
                        .frame(width: tileSize, height: tileSize)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(activityColor(6))
                        .frame(width: tileSize, height: tileSize)
                    Text("More")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 4)
            }
            .padding(.horizontal, 16)
            // .padding(.vertical, 8)
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
