import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerInfoSection: View {
        let player: Player

        var body: some View {
            Section {
                HStack {
                    if let photoData = player.photoData,
                        let uiImage = UIImage(data: photoData)
                    {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 120, height: 120)
                            .clipShape(Circle())
                    } else {
                        PlayerInitialsView(
                            name: player.name,
                            size: 120,
                            color: player.color
                        )
                    }
                }
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
            }
        }
    }
#endif
