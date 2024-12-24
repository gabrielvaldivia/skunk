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

    init(game: Game) {
        self.game = game
        // Get the most recent match for this game
        if let lastMatch = game.matches.sorted(by: { $0.date > $1.date }).first,
            lastMatch.players.count >= 2
        {
            _player1 = State(initialValue: lastMatch.players[0])
            _player2 = State(initialValue: lastMatch.players[1])
        }
    }

    private var recentPlayers: [Player] {
        // Get unique players from recent matches, ordered by most recent
        let allRecentPlayers = game.matches
            .sorted(by: { $0.date > $1.date })
            .flatMap { $0.players }
        return Array(NSOrderedSet(array: allRecentPlayers)) as? [Player] ?? []
    }

    private var availablePlayers: [Player] {
        players.filter { player in
            player != player1 && player != player2
        }
    }

    private var canSave: Bool {
        player1 != nil && player2 != nil && player1 != player2
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Players") {
                    playerPicker(selection: $player1, excludingPlayer: player2, label: "Player 1")
                    if !game.isBinaryScore {
                        scoreField(score: $score1)
                    }

                    playerPicker(selection: $player2, excludingPlayer: player1, label: "Player 2")
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
        }
    }

    private func playerPicker(selection: Binding<Player?>, excludingPlayer: Player?, label: String)
        -> some View
    {
        HStack {
            Text(label)
            Spacer()
            if let selectedPlayer = selection.wrappedValue {
                NavigationLink(destination: PlayerDetailView(player: selectedPlayer)) {
                    Text(selectedPlayer.name)
                }
            } else {
                Menu {
                    ForEach(players.filter { $0 != excludingPlayer }) { player in
                        Button {
                            selection.wrappedValue = player
                        } label: {
                            Text(player.name)
                        }
                    }
                } label: {
                    Text(label)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func playerRow(_ player: Player) -> some View {
        HStack {
            if let photoData = player.photoData,
                let uiImage = UIImage(data: photoData)
            {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 30, height: 30)
                    .clipShape(Circle())
            } else {
                PlayerInitialsView(name: player.name, size: 30)
            }
            Text(player.name)
                .padding(.leading, 8)
        }
    }

    private func playerColor(name: String) -> Color {
        let hash = abs(name.hashValue)
        let hue = Double(hash % 255) / 255.0
        return Color(hue: hue, saturation: 0.8, brightness: 0.7)
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
        match.players = [player1, player2]

        // Set winner based on scores
        if score1 > score2 {
            match.winner = player1
        } else if score2 > score1 {
            match.winner = player2
        }

        // Save scores for point-based games
        if !game.isBinaryScore {
            let score1Obj = Score(player: player1, match: match, points: score1)
            let score2Obj = Score(player: player2, match: match, points: score2)
            match.scores = [score1Obj, score2Obj]
            modelContext.insert(score1Obj)
            modelContext.insert(score2Obj)
        }

        modelContext.insert(match)
        game.matches.append(match)

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
