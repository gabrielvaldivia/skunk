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
                        if let photoData = winner.photoData {
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
