import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerRow: View {
        let player: Player

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
                        name: player.name,
                        size: 40,
                        color: player.color
                    )
                }

                Text(player.name)
                    .font(.body)
            }
        }
    }
#endif
