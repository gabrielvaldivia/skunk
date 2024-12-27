import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerRow: View {
        let player: Player

        private var playerColor: Color {
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

        var body: some View {
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
                        color: playerColor
                    )
                }

                VStack(alignment: .leading) {
                    Text(player.name ?? "")
                        .font(.headline)
                    if player.appleUserID != nil {
                        Text(player.isOnline ? "Online" : "Offline")
                            .font(.caption)
                            .foregroundStyle(player.isOnline ? .green : .secondary)
                    }
                }
            }
        }
    }
#endif
