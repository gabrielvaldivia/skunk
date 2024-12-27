import SwiftData
import SwiftUI

struct MatchRow: View {
    let match: Match

    private func playerColor(for player: Player) -> Color {
        // Generate a consistent color based on the name
        let hash = abs(player.name?.hashValue ?? 0)
        let hue = Double(hash % 255) / 255.0
        return Color(hue: hue, saturation: 0.7, brightness: 0.9)
    }

    private func playerImage(_ player: Player) -> AnyView {
        if player.photoData != nil {
            return AnyView(
                Circle()
                    .fill(playerColor(for: player))
                    .frame(width: 30, height: 30)
                    .overlay {
                        Image(systemName: "person.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(.white)
                    }
            )
        } else {
            return AnyView(
                PlayerInitialsView(
                    name: player.name ?? "",
                    size: 30,
                    color: playerColor(for: player)
                )
            )
        }
    }

    var body: some View {
        NavigationLink(value: match) {
            HStack {
                VStack(alignment: .leading) {
                    if let game = match.game {
                        Text(game.title ?? "")
                            .font(.headline)
                    }
                    Text(match.date, style: .date)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if let winner = match.winner {
                    HStack(spacing: 4) {
                        if winner.photoData != nil {
                            Circle()
                                .fill(playerColor(for: winner))
                                .frame(width: 24, height: 24)
                                .overlay {
                                    Image(systemName: "person.fill")
                                        .foregroundStyle(.white)
                                }
                        } else {
                            PlayerInitialsView(
                                name: winner.name ?? "",
                                size: 24,
                                color: playerColor(for: winner)
                            )
                        }
                        Text("Winner")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}
