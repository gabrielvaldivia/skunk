import SwiftData
import SwiftUI
import UIKit

struct MatchRow: View {
    let match: Match
    let showGameTitle: Bool
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.self) private var environment
    @Environment(\.modelContext) private var modelContext

    init(match: Match, showGameTitle: Bool = true) {
        self.match = match
        self.showGameTitle = showGameTitle
    }

    private var backgroundColor: Color {
        Color(
            uiColor: environment.colorScheme == .dark
                ? .secondarySystemGroupedBackground : .systemGroupedBackground)
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                if showGameTitle, let game = match.game {
                    Text(game.title)
                        .font(.headline)
                }
                Text(match.date, style: .date)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Player photos
            ZStack {
                ForEach(Array(match.players.enumerated()), id: \.element.id) { index, player in
                    playerView(for: player)
                        .offset(x: Double(index) * -20)
                        .zIndex("\(player.persistentModelID)" == match.winnerID ? 1 : 0)
                }
            }
            .padding(.leading)
        }
    }

    private func playerView(for player: Player) -> some View {
        Group {
            if let photoData = player.photoData,
                let uiImage = UIImage(data: photoData)
            {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 32, height: 32)
                    .clipShape(Circle())
            } else {
                PlayerInitialsView(name: player.name, size: 32)
            }
        }
        .opacity("\(player.persistentModelID)" == match.winnerID ? 1.0 : 0.5)
        .overlay(
            Circle()
                .stroke(backgroundColor, lineWidth: 2)
        )
        .overlay(alignment: .top) {
            if "\(player.persistentModelID)" == match.winnerID {
                Text("👑")
                    .font(.system(size: 12))
                    .offset(y: -8)
            }
        }
    }
}

struct MatchRow_Previews: PreviewProvider {
    static var container: ModelContainer {
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

        return container
    }

    static var match: Match {
        let descriptor = FetchDescriptor<Match>()
        return try! container.mainContext.fetch(descriptor).first!
    }

    static var previews: some View {
        NavigationStack {
            MatchRow(match: match, showGameTitle: true)
        }
        .modelContainer(container)
    }
}
