import SwiftData
import SwiftUI
import UIKit

struct NewMatchView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let game: Game
    @State private var player1: Player?
    @State private var player2: Player?
    @State private var score1: Int = 0
    @State private var score2: Int = 0

    @Query(sort: \Match.date, order: .reverse) private var matches: [Match]
    @Query private var players: [Player]

    // Get the default players from the last match
    private var defaultPlayers: (Player?, Player?) {
        if let lastMatch = game.matches.sorted(by: { $0.date > $1.date }).first,
            lastMatch.players.count >= 2
        {
            return (lastMatch.players[0], lastMatch.players[1])
        }
        return (nil, nil)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Players") {
                    Picker("Player 1", selection: $player1) {
                        Text("Select Player").tag(nil as Player?)
                        ForEach(players.filter { $0 != player2 }) { player in
                            Text(player.name).tag(player as Player?)
                        }
                    }
                    if !game.isBinaryScore {
                        scoreField(score: $score1)
                    }

                    Picker("Player 2", selection: $player2) {
                        Text("Select Player").tag(nil as Player?)
                        ForEach(players.filter { $0 != player1 }) { player in
                            Text(player.name).tag(player as Player?)
                        }
                    }
                    if !game.isBinaryScore {
                        scoreField(score: $score2)
                    }
                }

                if game.isBinaryScore {
                    Section("Winner") {
                        Picker(
                            "Winner",
                            selection: .init(
                                get: {
                                    score1 > score2 ? player1 : (score2 > score1 ? player2 : nil)
                                },
                                set: { winner in
                                    if winner == player1 {
                                        score1 = 1
                                        score2 = 0
                                    } else if winner == player2 {
                                        score1 = 0
                                        score2 = 1
                                    }
                                }
                            )
                        ) {
                            Text("Select Winner").tag(nil as Player?)
                            if let player1 = player1 {
                                Text(player1.name).tag(player1 as Player?)
                            }
                            if let player2 = player2 {
                                Text(player2.name).tag(player2 as Player?)
                            }
                        }
                        .disabled(player1 == nil || player2 == nil)
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
                    .disabled(!canSave || (game.isBinaryScore && score1 == score2))
                }
            }
            .onAppear {
                // Set default players on appear
                let (p1, p2) = defaultPlayers
                if player1 == nil { player1 = p1 }
                if player2 == nil { player2 = p2 }
            }
        }
    }

    private var canSave: Bool {
        player1 != nil && player2 != nil && player1 != player2
    }

    private func scoreField(score: Binding<Int>) -> some View {
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
        guard let player1 = player1, let player2 = player2 else { return }

        let match = Match(game: game)
        modelContext.insert(match)

        // Set up relationships
        match.players = [player1, player2]
        match.game = game  // Ensure the game relationship is set
        game.matches.append(match)

        // Set winner based on scores
        if score1 > score2 {
            match.winnerID = "\(player1.persistentModelID)"
        } else if score2 > score1 {
            match.winnerID = "\(player2.persistentModelID)"
        }

        // Save scores for point-based games
        if !game.isBinaryScore {
            let score1Obj = Score(player: player1, match: match, points: score1)
            let score2Obj = Score(player: player2, match: match, points: score2)
            match.scores = [score1Obj, score2Obj]
            modelContext.insert(score1Obj)
            modelContext.insert(score2Obj)
        }

        // Update player relationships
        player1.matches.append(match)
        player2.matches.append(match)

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
