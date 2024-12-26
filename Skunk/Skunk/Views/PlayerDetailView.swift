import Charts
import SwiftData
import SwiftUI
import UIKit

extension UIColor {
    var hue: Double {
        var h: CGFloat = 0
        getHue(&h, saturation: nil, brightness: nil, alpha: nil)
        return Double(h)
    }
}

struct PlayerDetailView: View {
    let player: Player
    @State private var isImagePickerPresented = false
    @State private var selectedImage: UIImage?
    @State private var isEditing = false
    @State private var editedName: String = ""
    @Environment(\.modelContext) private var modelContext
    @Query private var games: [Game]

    private var championedGames: [Game] {
        games.filter { game in
            guard !game.matches.isEmpty else { return false }
            let playerWins = Dictionary(grouping: game.matches.compactMap { $0.winner }) { $0 }
                .mapValues { $0.count }
            guard !playerWins.isEmpty else { return false }
            return playerWins.max(by: { $0.value < $1.value })?.key == player
        }
    }

    private var longestStreak: Int {
        let sortedMatches = player.matches.sorted(by: { $0.date < $1.date })
        var currentStreak = 0
        var maxStreak = 0

        for match in sortedMatches {
            if match.winner == player {
                currentStreak += 1
                maxStreak = max(maxStreak, currentStreak)
            } else {
                currentStreak = 0
            }
        }

        return maxStreak
    }

    private var winRate: Double {
        let totalMatches = player.matches.count
        guard totalMatches > 0 else { return 0 }
        let wins = player.matches.filter { $0.winner == player }.count
        let rate = Double(wins) / Double(totalMatches) * 100
        return rate.isFinite ? rate : 0
    }

    private var mostPlayedGame: (game: Game, count: Int)? {
        let gameMatches = Dictionary(grouping: player.matches) { $0.game }
        return gameMatches.map { ($0.key!, $0.value.count) }
            .max(by: { $0.1 < $1.1 })
    }

    private var mostFrequentOpponent: (player: Player, count: Int)? {
        var opponentCounts: [Player: Int] = [:]
        for match in player.matches {
            for opponent in match.players where opponent != player {
                opponentCounts[opponent, default: 0] += 1
            }
        }
        return opponentCounts.map { ($0.key, $0.value) }
            .max(by: { $0.1 < $1.1 })
    }

    private var gameStats: [(game: Game, played: Int, wins: Int, winRate: Double)] {
        let gameMatches = Dictionary(grouping: player.matches) { $0.game }
        return gameMatches.compactMap { game, matches in
            guard let game = game else { return nil }
            let wins = matches.filter { $0.winner == player }.count
            let winRate = Double(wins) / Double(matches.count) * 100
            return (game, matches.count, wins, winRate)
        }.sorted { $0.played > $1.played }
    }

    private var averageScores: [(game: Game, average: Double)] {
        let gameMatches = Dictionary(grouping: player.matches) { $0.game }
        return gameMatches.compactMap { game, matches in
            guard let game = game, !game.isBinaryScore else { return nil }
            let scores = matches.compactMap { match in
                match.scores.first(where: { $0.player == player })?.points
            }
            guard !scores.isEmpty else { return nil }
            let average = Double(scores.reduce(0, +)) / Double(scores.count)
            return (game, average)
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
                            .frame(width: 100, height: 100)
                            .clipShape(Circle())
                    } else {
                        PlayerInitialsView(
                            name: player.name,
                            size: 100,
                            colorData: player.colorData)
                    }

                    Text(player.name)
                        .font(.title)
                        .bold()
                }
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
            }

            if !championedGames.isEmpty {
                Section("Current Champion Of") {
                    ForEach(championedGames) { game in
                        NavigationLink(destination: GameDetailView(game: game)) {
                            HStack {
                                Text(game.title)
                                Spacer()
                                Text("\(game.matches.filter { $0.winner == player }.count) wins")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            Section("Stats") {
                let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 2)
                LazyVGrid(columns: columns, spacing: 12) {
                    StatCard(title: "Matches Played", value: player.matches.count)
                    StatCard(
                        title: "Matches Won",
                        value: player.matches.filter { $0.winner == player }.count)
                    StatCard(title: "Win Rate", value: "\(max(0, min(100, Int(winRate))))%")
                    StatCard(title: "Longest Streak", value: longestStreak)
                }
                .padding(.vertical, 8)
            }

            if !gameStats.isEmpty {
                Section("Game Performance") {
                    ForEach(gameStats, id: \.game.id) { stat in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(stat.game.title)
                                    .font(.headline)
                                Text("\(stat.played) matches, \(stat.wins) wins")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Text("\(Int(stat.winRate))%")
                                .font(.title3.bold())
                                .foregroundStyle(stat.winRate >= 50 ? .green : .red)
                        }
                    }
                }
            }

            if !averageScores.isEmpty {
                Section("Average Scores") {
                    ForEach(averageScores, id: \.game.id) { stat in
                        HStack {
                            Text(stat.game.title)
                            Spacer()
                            Text(String(format: "%.1f pts", stat.average))
                                .font(.headline)
                        }
                    }
                }
            }

            if !player.matches.isEmpty {
                Section("Win Rate Over Time") {
                    WinLossTimelineView(matches: player.matches, player: player)
                }

                Section("Performance by Time of Day") {
                    TimeOfDayPerformanceView(matches: player.matches, player: player)
                }

                Section("Head-to-Head Records") {
                    HeadToHeadView(matches: player.matches, player: player)
                }
            }

            Section("Match History") {
                let sortedMatches = player.matches.sorted(by: { $0.date > $1.date })
                if sortedMatches.isEmpty {
                    Text("No matches played yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(sortedMatches) { match in
                        MatchRow(match: match)
                    }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            Button(action: {
                editedName = player.name
                if let imageData = player.photoData {
                    selectedImage = UIImage(data: imageData)
                }
                isEditing = true
            }) {
                Text("Edit")
            }
        }
        .sheet(isPresented: $isEditing) {
            NavigationStack {
                PlayerFormView(
                    name: $editedName,
                    selectedImage: $selectedImage,
                    color: Binding(
                        get: {
                            if let colorData = player.colorData,
                                let uiColor = try? NSKeyedUnarchiver.unarchivedObject(
                                    ofClass: UIColor.self, from: colorData)
                            {
                                Color(uiColor: uiColor)
                            } else {
                                .blue
                            }
                        },
                        set: { newColor in
                            if let colorData = try? NSKeyedArchiver.archivedData(
                                withRootObject: UIColor(newColor), requiringSecureCoding: true)
                            {
                                player.colorData = colorData
                            }
                        }
                    ),
                    existingPhotoData: player.photoData,
                    existingColorData: player.colorData,
                    title: "Edit Player"
                )
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            isEditing = false
                            editedName = player.name
                            if let imageData = player.photoData {
                                selectedImage = UIImage(data: imageData)
                            } else {
                                selectedImage = nil
                            }
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            if !editedName.isEmpty {
                                player.name = editedName
                                if let image = selectedImage {
                                    player.photoData = image.jpegData(compressionQuality: 0.8)
                                }
                                try? modelContext.save()
                            }
                            isEditing = false
                        }
                        .disabled(editedName.isEmpty)
                    }
                }
            }
            .sheet(isPresented: $isImagePickerPresented) {
                ImagePicker(image: $selectedImage)
            }
        }
    }
}

struct StatCard: View {
    let title: String
    let value: CustomStringConvertible
    let destination: (() -> any View)?

    init(title: String, value: CustomStringConvertible, destination: (() -> any View)? = nil) {
        self.title = title
        self.value = value
        self.destination = destination
    }

    var body: some View {
        Group {
            if let destination = destination {
                NavigationLink(destination: AnyView(destination())) {
                    cardContent
                }
            } else {
                cardContent
            }
        }
    }

    private var cardContent: some View {
        VStack(alignment: .center, spacing: 4) {
            Text(value.description)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(.primary)
                .minimumScaleFactor(0.5)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 100)
        .padding(.vertical, 12)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct WinLossTimelineView: View {
    let matches: [Match]
    let player: Player

    private var timelineData: [(date: Date, winRate: Int)] {
        let sortedMatches = matches.sorted(by: { $0.date < $1.date })
        var cumulativeWins = 0
        var cumulativeGames = 0
        return sortedMatches.map { match in
            if match.winner == player {
                cumulativeWins += 1
            }
            cumulativeGames += 1
            let rate = Double(cumulativeWins) / Double(cumulativeGames) * 100
            let safeRate = rate.isFinite ? rate : 0
            return (
                match.date, max(0, min(100, Int(safeRate)))
            )
        }
    }

    var body: some View {
        Chart(timelineData, id: \.date) { data in
            LineMark(
                x: .value("Date", data.date),
                y: .value("Win Rate", data.winRate)
            )
            .foregroundStyle(Color.blue)
        }
        .chartYScale(domain: 0...100)
        .chartYAxis {
            AxisMarks(values: [0, 25, 50, 75, 100]) { value in
                AxisGridLine()
                AxisValueLabel {
                    Text("\(Int(value.as(Double.self) ?? 0))%")
                }
            }
        }
        .frame(height: 200)
    }
}

struct MatchHistoryTimelineView: View {
    let matches: [Match]
    let player: Player
    let opponent: Player

    private var matchHistory: [(date: Date, isWin: Bool, score: String?)] {
        matches.filter { match in
            match.players.contains(opponent)
        }
        .sorted(by: { $0.date < $1.date })
        .map { match in
            let isWin = match.winner == player
            let score: String?
            if !match.scores.isEmpty {
                let playerScore = match.scores.first(where: { $0.player == player })?.points ?? 0
                let opponentScore =
                    match.scores.first(where: { $0.player == opponent })?.points ?? 0
                score = "\(playerScore)-\(opponentScore)"
            } else {
                score = nil
            }
            return (match.date, isWin, score)
        }
    }

    var body: some View {
        Chart {
            ForEach(matchHistory, id: \.date) { match in
                PointMark(
                    x: .value("Date", match.date),
                    y: .value("Result", match.isWin ? 1 : 0)
                )
                .foregroundStyle(match.isWin ? Color.green : Color.red)

                if let score = match.score {
                    RuleMark(
                        x: .value("Date", match.date),
                        yStart: .value("Result", match.isWin ? 0.8 : -0.3),
                        yEnd: .value("Result", match.isWin ? 1.2 : 0.1)
                    )
                    .annotation(position: match.isWin ? .top : .bottom) {
                        Text(score)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .chartYScale(domain: -0.5...1.5)
        .chartYAxis {
            AxisMarks(values: [0, 1]) { value in
                AxisValueLabel {
                    Text(value.as(Int.self) == 1 ? "Win" : "Loss")
                }
            }
        }
        .frame(height: 200)
    }
}

struct WinRateProgressionView: View {
    let matches: [Match]
    let player: Player
    let opponent: Player

    private var progressionData: [(date: Date, winRate: Int)] {
        let relevantMatches = matches.filter { match in
            match.players.contains(opponent)
        }
        .sorted(by: { $0.date < $1.date })

        var wins = 0
        var games = 0
        return relevantMatches.map { match in
            if match.winner == player {
                wins += 1
            }
            games += 1
            let rate = Double(wins) / Double(games) * 100
            let safeRate = rate.isFinite ? rate : 0
            return (match.date, max(0, min(100, Int(safeRate))))
        }
    }

    var body: some View {
        Chart {
            ForEach(progressionData, id: \.date) { data in
                LineMark(
                    x: .value("Date", data.date),
                    y: .value("Win Rate", data.winRate)
                )
                .foregroundStyle(Color.blue.gradient)

                AreaMark(
                    x: .value("Date", data.date),
                    y: .value("Win Rate", data.winRate)
                )
                .foregroundStyle(Color.blue.opacity(0.1))
            }
        }
        .chartYScale(domain: 0...100)
        .chartYAxis {
            AxisMarks(values: [0, 25, 50, 75, 100]) { value in
                AxisGridLine()
                AxisValueLabel {
                    Text("\(Int(value.as(Double.self) ?? 0))%")
                }
            }
        }
        .frame(height: 200)
    }
}

struct HeadToHeadDetailView: View {
    let matches: [Match]
    let player: Player
    let opponent: Player

    private var relevantMatches: [Match] {
        matches.filter { match in
            match.players.contains(opponent)
        }
    }

    private var stats: (wins: Int, losses: Int, winRate: Int) {
        var wins = 0
        var losses = 0
        for match in relevantMatches {
            if match.winner == player {
                wins += 1
            } else if match.winner == opponent {
                losses += 1
            }
        }
        let total = wins + losses
        let rate = total > 0 ? (Double(wins) / Double(total) * 100) : 0
        let safeRate = rate.isFinite ? rate : 0
        return (wins, losses, max(0, min(100, Int(safeRate))))
    }

    var body: some View {
        List {
            Section("Match History") {
                MatchHistoryTimelineView(
                    matches: relevantMatches,
                    player: player,
                    opponent: opponent
                )
            }

            Section("Win Rate Progression") {
                WinRateProgressionView(
                    matches: relevantMatches,
                    player: player,
                    opponent: opponent
                )
            }
        }
        .navigationTitle("\(player.name) vs \(opponent.name)")
    }
}

struct HeadToHeadView: View {
    let matches: [Match]
    let player: Player

    private var opponentRecords: [(opponent: Player, wins: Int, losses: Int)] {
        // Group matches by opponent
        var records: [Player: (wins: Int, losses: Int)] = [:]

        for match in matches {
            for opponent in match.players where opponent != player {
                if match.winner == player {
                    records[opponent, default: (0, 0)].wins += 1
                } else if match.winner == opponent {
                    records[opponent, default: (0, 0)].losses += 1
                }
            }
        }

        // Convert to array
        let recordsArray = records.map { opponent, record in
            (opponent: opponent, wins: record.wins, losses: record.losses)
        }

        // Sort by total games and get top 5
        let sortedRecords = recordsArray.sorted { first, second in
            let firstTotal = first.wins + first.losses
            let secondTotal = second.wins + second.losses
            return firstTotal > secondTotal
        }

        return Array(sortedRecords.prefix(5))
    }

    var body: some View {
        VStack(spacing: 12) {
            ForEach(opponentRecords, id: \.opponent.id) { record in
                NavigationLink(
                    destination: HeadToHeadDetailView(
                        matches: matches,
                        player: player,
                        opponent: record.opponent
                    )
                ) {
                    HStack {
                        if let photoData = record.opponent.photoData,
                            let uiImage = UIImage(data: photoData)
                        {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 32, height: 32)
                                .clipShape(Circle())
                        } else {
                            PlayerInitialsView(
                                name: record.opponent.name,
                                size: 32,
                                colorData: record.opponent.colorData)
                        }

                        Text(record.opponent.name)
                            .font(.subheadline)

                        Spacer()

                        Text("\(record.wins)-\(record.losses)")
                            .font(.subheadline.bold())
                            .foregroundStyle(
                                record.wins > record.losses
                                    ? .green : record.wins < record.losses ? .red : .primary
                            )
                    }
                }
            }

            if opponentRecords.isEmpty {
                Text("No matches against other players yet")
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct TimeOfDayPerformanceView: View {
    let matches: [Match]
    let player: Player

    private var timeBlockStats: [(block: String, winRate: Double, matches: Int)] {
        // Define time blocks (4-hour periods)
        let blocks = [
            (name: "🌅", range: 0..<6),
            (name: "☀️", range: 6..<10),
            (name: "🌞", range: 10..<14),
            (name: "🌤️", range: 14..<18),
            (name: "🌆", range: 18..<22),
            (name: "🌙", range: 22..<24),
        ]

        var blockStats: [(String, wins: Int, total: Int)] = blocks.map { ($0.name, 0, 0) }

        for match in matches {
            let hour = Calendar.current.component(.hour, from: match.date)
            let blockIndex = blocks.firstIndex { $0.range.contains(hour) } ?? 0
            blockStats[blockIndex].2 += 1
            if match.winner == player {
                blockStats[blockIndex].1 += 1
            }
        }

        return blockStats.map { name, wins, total in
            let winRate = total > 0 ? Double(wins) / Double(total) * 100 : 0
            return (name, winRate, total)
        }
    }

    var body: some View {
        Chart {
            ForEach(timeBlockStats, id: \.block) { stat in
                BarMark(
                    x: .value("Time", stat.block),
                    y: .value("Win Rate", stat.winRate)
                )
                .foregroundStyle(
                    Color.blue.opacity(stat.matches > 0 ? 1 : 0.3)
                )
                .annotation(position: .top) {
                    if stat.matches > 0 {
                        Text("\(stat.matches)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .chartYScale(domain: 0...100)
        .chartYAxis {
            AxisMarks(values: [0, 25, 50, 75, 100]) { value in
                AxisGridLine()
                AxisValueLabel {
                    Text("\(Int(value.as(Double.self) ?? 0))%")
                }
            }
        }
        .chartXAxis {
            AxisMarks { _ in
                AxisValueLabel()
            }
        }
        .frame(height: 200)
    }
}

#Preview {
    do {
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: Player.self, configurations: config)
        let player = Player(name: "Alice")
        return NavigationStack {
            PlayerDetailView(player: player)
        }
        .modelContainer(container)
    } catch {
        return Text("Failed to create preview: \(error.localizedDescription)")
    }
}
