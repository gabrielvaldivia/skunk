import SwiftData
import SwiftUI

struct MatchDetailView: View {
    let match: Match
    @Environment(\.modelContext) private var modelContext

    private func playerView(_ player: Player) -> some View {
        HStack {
            if let photoData = player.photoData,
                let uiImage = UIImage(data: photoData)
            {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 40, height: 40)
                    .clipShape(Circle())
            } else {
                PlayerInitialsView(name: player.name, size: 40, colorHue: player.colorHue)
            }

            VStack(alignment: .leading) {
                Text(player.name)
                    .font(.headline)
                if "\(player.persistentModelID)" == match.winnerID {
                    Text("Winner")
                        .font(.caption)
                        .foregroundStyle(.green)
                }
            }

            if let game = match.game, !game.isBinaryScore {
                Spacer()
                if let score = match.scores.first(where: { $0.player == player }) {
                    Text("\(score.points) points")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    var body: some View {
        List {
            Section {
                if let game = match.game {
                    LabeledContent("Game", value: game.title)
                }
                LabeledContent("Date", value: match.date, format: .dateTime)
            }

            Section("Players") {
                ForEach(match.players) { player in
                    playerView(player)
                }
            }
        }
        .navigationTitle("Match Details")
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(
        for: Game.self, Match.self, Player.self,
        configurations: config
    )

    let game = Game(title: "Chess", isBinaryScore: true, supportedPlayerCounts: [2])
    let player1 = Player(name: "Alice")
    let player2 = Player(name: "Bob")
    let match = Match(game: game)

    container.mainContext.insert(game)
    container.mainContext.insert(player1)
    container.mainContext.insert(player2)
    container.mainContext.insert(match)

    match.players = [player1, player2]
    match.winnerID = "\(player1.persistentModelID)"

    return NavigationStack {
        MatchDetailView(match: match)
    }
    .modelContainer(container)
}
