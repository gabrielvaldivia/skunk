import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit
#else
    import AppKit
#endif

struct MatchDetailView: View {
    let match: Match
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    private func playerView(_ player: Player) -> some View {
        Button(action: {
            match.winnerID = "\(player.persistentModelID)"
            try? modelContext.save()
        }) {
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
                    PlayerInitialsView(
                        name: player.name ?? "",
                        size: 40,
                        colorData: player.colorData)
                }

                Text(player.name ?? "")
                    .font(.headline)

                Spacer()

                if "\(player.persistentModelID)" == match.winnerID {
                    Text("Winner")
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }

                if let game = match.game, !game.isBinaryScore,
                    let score = match.scores?.first(where: { $0.player == player })
                {
                    Text("\(score.points) points")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .buttonStyle(.plain)
    }

    var body: some View {
        List {
            Section {
                if let game = match.game {
                    LabeledContent("Game", value: game.title ?? "")
                }
                LabeledContent("Date", value: match.date, format: .dateTime)
            }

            Section("Players") {
                ForEach(match.orderedPlayers) { player in
                    playerView(player)
                }
            }

            Section {
                Button(role: .destructive) {
                    // Remove match from game's matches array
                    if let game = match.game,
                        var matches = game.matches
                    {
                        matches.removeAll { $0.id == match.id }
                        game.matches = matches
                    }

                    // Remove match from all players' matches arrays
                    if let players = match.players {
                        for player in players {
                            if var matches = player.matches {
                                matches.removeAll { $0.id == match.id }
                                player.matches = matches
                            }
                        }
                    }

                    // Delete all associated scores
                    if let scores = match.scores {
                        for score in scores {
                            modelContext.delete(score)
                        }
                    }

                    // Finally delete the match
                    modelContext.delete(match)
                    try? modelContext.save()
                    dismiss()
                } label: {
                    Text("Delete Match")
                        .frame(maxWidth: .infinity)
                }
            }
        }
        .navigationTitle("Match Details")
    }
}
