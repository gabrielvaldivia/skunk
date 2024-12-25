import Charts
import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit
#endif

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

struct EditGameView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let game: Game
    @State private var title: String
    @State private var isBinaryScore: Bool
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var minPlayers: Int
    @State private var maxPlayers: Int
    @State private var showingDeleteConfirmation = false

    init(game: Game) {
        self.game = game
        _title = State(initialValue: game.title)
        _isBinaryScore = State(initialValue: game.isBinaryScore)
        _minPlayers = State(initialValue: game.supportedPlayerCounts.min() ?? 2)
        _maxPlayers = State(initialValue: game.supportedPlayerCounts.max() ?? 4)
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Game Title", text: $title)

                Toggle(
                    "Track Score",
                    isOn: Binding(
                        get: { !isBinaryScore },
                        set: { isBinaryScore = !$0 }
                    )
                )
                .toggleStyle(.switch)

                Section("Player Count") {
                    Stepper(
                        "Minimum \(minPlayers) Players", value: $minPlayers, in: 1...maxPlayers)
                    Stepper(
                        "Maximum \(maxPlayers) Players", value: $maxPlayers, in: minPlayers...99)
                }

                Section {
                    Button(role: .destructive) {
                        showingDeleteConfirmation = true
                    } label: {
                        Text("Delete Game")
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .navigationTitle("Edit Game")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveGame()
                    }
                    .disabled(title.isEmpty)
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage)
            }
            .alert("Delete Game", isPresented: $showingDeleteConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    deleteGame()
                }
            } message: {
                Text("Are you sure you want to delete this game? This action cannot be undone.")
            }
        }
    }

    private func saveGame() {
        game.title = title
        game.isBinaryScore = isBinaryScore
        game.supportedPlayerCounts = Set(minPlayers...maxPlayers)

        do {
            try modelContext.save()
            print("Successfully updated game: \(title)")
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
            print("Failed to save game: \(error)")
        }
    }

    private func deleteGame() {
        // Delete all matches associated with this game
        for match in game.matches {
            // Remove match from all players' matches arrays
            for player in match.players {
                player.matches.removeAll { $0.id == match.id }
            }
            // Delete all associated scores
            for score in match.scores {
                modelContext.delete(score)
            }
            modelContext.delete(match)
        }

        // Finally delete the game
        modelContext.delete(game)
        try? modelContext.save()
        dismiss()
    }
}

struct GameDetailView: View {
    let game: Game
    @State private var showingNewMatch = false
    @State private var showingEditGame = false
    @Environment(\.modelContext) private var modelContext

    private var championshipStatus: (winner: Player?, isDraw: Bool) {
        // Return early if no matches
        if game.matches.isEmpty { return (nil, false) }

        // Get all winners
        var winners: [Player] = []
        for match in game.matches {
            if let winner = match.winner {
                winners.append(winner)
            }
        }
        if winners.isEmpty { return (nil, false) }

        // Count wins for each player
        var winCounts: [Player: Int] = [:]
        for winner in winners {
            winCounts[winner, default: 0] += 1
        }

        // Find the highest win count
        var maxCount = 0
        for count in winCounts.values {
            maxCount = max(maxCount, count)
        }

        // Find players with the highest win count
        var topPlayers: [Player] = []
        for (player, count) in winCounts {
            if count == maxCount {
                topPlayers.append(player)
            }
        }

        // If more than one player has the highest count, it's a draw
        if topPlayers.count > 1 {
            return (nil, true)
        }

        // Otherwise, return the winner
        return (topPlayers.first, false)
    }

    private var winCounts: [(player: Player, count: Int)] {
        // Return empty array if no matches or winners
        if game.matches.isEmpty { return [] }

        // Get all winners
        var winners: [Player] = []
        for match in game.matches {
            if let winner = match.winner {
                winners.append(winner)
            }
        }
        if winners.isEmpty { return [] }

        // Count wins for each player
        var counts: [Player: Int] = [:]
        for winner in winners {
            counts[winner, default: 0] += 1
        }

        // Convert to array of tuples
        var pairs: [(player: Player, count: Int)] = []
        for (player, count) in counts {
            pairs.append((player: player, count: count))
        }

        // Sort by count (highest first)
        pairs.sort { $0.count > $1.count }

        return pairs
    }

    private var totalWins: Int {
        var total = 0
        for (_, count) in winCounts {
            total += count
        }
        return total
    }

    var body: some View {
        ZStack {
            if game.matches.isEmpty {
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
                                        let winCount = game.matches.filter { $0.winner == champion }
                                            .count
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
                                        let winCount = entry.count
                                        let winPercentage =
                                            Double(winCount) / Double(totalWins) * 100.0
                                        let roundedPercentage = Int(winPercentage)
                                        Text("\(winCount) wins (\(roundedPercentage)%)")
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
                        ForEach(sortedMatches) { match in
                            MatchRow(match: match, showGameTitle: false)
                        }
                    }
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
            NewMatchView(game: game)
        }
        .sheet(isPresented: $showingEditGame) {
            EditGameView(game: game)
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
