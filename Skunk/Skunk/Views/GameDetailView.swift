import Charts
import SwiftData
import SwiftUI
import UIKit

private func playerColor(_ player: Player) -> Color {
    if let colorData = player.colorData,
        let uiColor = try? NSKeyedUnarchiver.unarchivedObject(
            ofClass: UIColor.self, from: colorData)
    {
        return Color(uiColor: uiColor)
    } else {
        return Color(hue: 0.5, saturation: 0.7, brightness: 0.9)
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
                .fill(playerColor(entry.player))
            }
        }
        .frame(width: 150, height: 150)
    }
}

struct GameDetailView: View {
    let game: Game
    @State private var showingNewMatch = false
    @Environment(\.modelContext) private var modelContext

    private var championshipStatus: (winner: Player?, isDraw: Bool) {
        let matches = game.matches
        let winners = matches.compactMap { $0.winner }
        let winCounts = Dictionary(grouping: winners) { $0 }
            .mapValues { $0.count }

        guard let maxCount = winCounts.values.max() else {
            return (nil, false)  // No games played
        }

        let topPlayers = winCounts.filter { $0.value == maxCount }
        if topPlayers.count > 1 {
            return (nil, true)  // Draw
        } else {
            return (topPlayers.first?.key, false)  // Clear winner
        }
    }

    private var winCounts: [(player: Player, count: Int)] {
        let winners = game.matches.compactMap { $0.winner }
        let counts = Dictionary(grouping: winners) { $0 }
            .mapValues { $0.count }
        return counts.map { ($0.key, $0.value) }
            .sorted { $0.1 > $1.1 }
    }

    private var totalWins: Int {
        winCounts.reduce(0) { $0 + $1.count }
    }

    var body: some View {
        List {
            Section("Champion") {
                if championshipStatus.isDraw {
                    Text("Draw")
                        .font(.headline)
                        .foregroundStyle(.orange)
                } else if let champion = championshipStatus.winner {
                    NavigationLink(destination: PlayerDetailView(player: champion)) {
                        HStack {
                            if let photoData = champion.photoData,
                                let uiImage = UIImage(data: photoData)
                            {
                                Image(uiImage: uiImage)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 40, height: 40)
                                    .clipShape(Circle())
                            } else {
                                PlayerInitialsView(
                                    name: champion.name,
                                    size: 40,
                                    colorData: champion.colorData)
                            }

                            VStack(alignment: .leading) {
                                Text(champion.name)
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                let winCount = game.matches.filter { $0.winner == champion }.count
                                Text("\(winCount) wins")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                    }
                }
            }

            if !game.matches.isEmpty {
                Section("Win Distribution") {
                    VStack(alignment: .center, spacing: 16) {
                        PieChartView(winCounts: winCounts, totalWins: totalWins)
                            .padding(.vertical)

                        ForEach(winCounts, id: \.player.id) { entry in
                            HStack {
                                Circle()
                                    .fill(playerColor(entry.player))
                                    .frame(width: 12, height: 12)
                                Text(entry.player.name)
                                Spacer()
                                let percentage = Int(
                                    (Double(entry.count) / Double(totalWins)) * 100.0)
                                Text("\(entry.count) wins (\(percentage)%)")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(20)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .frame(maxWidth: .infinity)
                    .listRowInsets(EdgeInsets())
                }
            }

            Section("Match History") {
                let sortedMatches = game.matches.sorted(by: { $0.date > $1.date })
                if sortedMatches.isEmpty {
                    Text("No matches yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(sortedMatches) { match in
                        MatchRow(match: match, showGameTitle: false)
                    }
                }
            }
        }
        .navigationTitle(game.title)
        .toolbar {
            Button(action: { showingNewMatch.toggle() }) {
                Label("New Match", systemImage: "plus")
            }
        }
        .sheet(isPresented: $showingNewMatch) {
            NewMatchView(game: game)
        }
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Game.self, configurations: config)
    let game = Game(title: "Chess", isBinaryScore: true, supportedPlayerCounts: [2])
    container.mainContext.insert(game)

    return NavigationStack {
        GameDetailView(game: game)
    }
    .modelContainer(container)
}
