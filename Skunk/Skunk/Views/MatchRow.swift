import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct MatchRow: View {
        let match: Match

        private func playerColor(for player: Player) -> Color {
            if let colorData = player.colorData,
                let uiColor = try? NSKeyedUnarchiver.unarchivedObject(
                    ofClass: UIColor.self, from: colorData)
            {
                return Color(uiColor: uiColor)
            }
            // Generate a consistent color based on the name
            let hash = abs(player.name?.hashValue ?? 0)
            let hue = Double(hash % 255) / 255.0
            return Color(hue: hue, saturation: 0.7, brightness: 0.9)
        }

        private func playerImage(_ player: Player) -> AnyView {
            if let photoData = player.photoData,
                let uiImage = UIImage(data: photoData)
            {
                return AnyView(
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 30, height: 30)
                        .clipShape(Circle())
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
                        if let photoData = winner.photoData,
                            let uiImage = UIImage(data: photoData)
                        {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 24, height: 24)
                                .clipShape(Circle())
                        } else {
                            PlayerInitialsView(
                                name: winner.name ?? "",
                                size: 24,
                                color: playerColor(for: winner)
                            )
                        }
                    }
                }
            }
        }
    }
#endif
