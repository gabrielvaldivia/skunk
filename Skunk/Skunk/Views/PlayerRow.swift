import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerRow: View {
        let player: Player
        @EnvironmentObject private var authManager: AuthenticationManager

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

        private var isCurrentUser: Bool {
            guard let currentUserID = authManager.userID else {
                print("❌ No current user ID")
                return false
            }

            guard let playerID = player.appleUserID else {
                print("❌ No apple user ID for player: \(player.name ?? "")")
                return false
            }

            return currentUserID == playerID
        }

        private var isManagedPlayer: Bool {
            guard let currentUserID = authManager.userID else { return false }
            return player.ownerID == currentUserID && player.appleUserID != currentUserID
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
                        .foregroundStyle(.primary)
                    if isCurrentUser {
                        Text("(you)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else if isManagedPlayer {
                        Text("(managed)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
#endif
