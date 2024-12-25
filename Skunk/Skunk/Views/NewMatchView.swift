import SwiftData
import SwiftUI

struct NewMatchView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let game: Game
    @State private var players: [Player?]
    @State private var scores: [Int]

    @Query(sort: \Match.date, order: .reverse) private var matches: [Match]
    @Query private var allPlayers: [Player]

    init(game: Game) {
        self.game = game
        let playerCount = game.supportedPlayerCounts.first ?? 2
        _players = State(initialValue: Array(repeating: nil, count: playerCount))
        _scores = State(initialValue: Array(repeating: 0, count: playerCount))
    }

    // Get the default players from the last match
    private var defaultPlayers: [Player?] {
        if let lastMatch = game.matches.sorted(by: { $0.date > $1.date }).first {
            return Array(lastMatch.players.prefix(players.count))
        }
        return Array(repeating: nil, count: players.count)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Players") {
                    ForEach(players.indices, id: \.self) { index in
                        Picker("Player \(index + 1)", selection: $players[index]) {
                            Text("Select Player").tag(nil as Player?)
                            ForEach(
                                allPlayers.filter { player in
                                    !players.contains { $0?.id == player.id }
                                        || players[index]?.id == player.id
                                }
                            ) { player in
                                Text(player.name).tag(player as Player?)
                            }
                        }
                        if !game.isBinaryScore {
                            scoreField(score: $scores[index], index: index)
                        }
                    }
                }

                if game.isBinaryScore {
                    Section("Winner") {
                        Picker(
                            "Winner",
                            selection: .init(
                                get: {
                                    let maxScore = scores.max() ?? 0
                                    if maxScore > 0,
                                        let winnerIndex = scores.firstIndex(of: maxScore)
                                    {
                                        return players[winnerIndex]
                                    }
                                    return nil
                                },
                                set: { winner in
                                    scores = Array(repeating: 0, count: scores.count)
                                    if let winnerIndex = players.firstIndex(where: {
                                        $0?.id == winner?.id
                                    }) {
                                        scores[winnerIndex] = 1
                                    }
                                }
                            )
                        ) {
                            Text("Select Winner").tag(nil as Player?)
                            ForEach(players.indices, id: \.self) { index in
                                if let player = players[index] {
                                    Text(player.name).tag(player as Player?)
                                }
                            }
                        }
                        .disabled(players.contains(nil))
                    }
                }
            }
            .navigationTitle("New Match")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveMatch()
                    }
                    .disabled(!canSave || (game.isBinaryScore && Set(scores).count == 1))
                }
            }
            .onAppear {
                // Set default players on appear
                let defaults = defaultPlayers
                for (index, player) in defaults.enumerated() where players[index] == nil {
                    players[index] = player
                }
            }
        }
    }

    private var canSave: Bool {
        !players.contains(nil) && Set(players.compactMap { $0?.id }).count == players.count
    }

    private func scoreField(score: Binding<Int>, index: Int) -> some View {
        HStack {
            Text("Score")
            Spacer()
            TextField(
                "Score",
                value: score,
                format: .number
            )
            .keyboardType(.numberPad)
            .multilineTextAlignment(.trailing)
            .frame(width: 80)
        }
    }

    private func saveMatch() {
        guard !players.contains(nil) else { return }

        let match = Match(game: game)
        modelContext.insert(match)

        // Set up relationships
        for player in players.compactMap({ $0 }) {
            match.addPlayer(player)
            player.matches.append(match)
        }
        match.game = game
        game.matches.append(match)

        // Set winner based on scores
        if let maxScore = scores.max(),
            let winnerIndex = scores.firstIndex(of: maxScore),
            let winner = players[winnerIndex]
        {
            match.winnerID = "\(winner.persistentModelID)"
        }

        // Save scores for point-based games
        if !game.isBinaryScore {
            for (index, player) in players.enumerated() {
                if let player = player {
                    let scoreObj = Score(player: player, match: match, points: scores[index])
                    match.scores.append(scoreObj)
                    modelContext.insert(scoreObj)
                }
            }
        }

        try? modelContext.save()
        dismiss()
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Game.self, configurations: config)
    let game = Game(title: "Chess", isBinaryScore: true, supportedPlayerCounts: [2])
    let player1 = Player(name: "Alice")
    let player2 = Player(name: "Bob")

    container.mainContext.insert(game)
    container.mainContext.insert(player1)
    container.mainContext.insert(player2)

    return NavigationStack {
        NewMatchView(game: game)
    }
    .modelContainer(container)
}
