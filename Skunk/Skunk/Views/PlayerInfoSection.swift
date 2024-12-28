import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerInfoSection: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        let playerId: String

        private var player: Player? {
            cloudKitManager.players.first(where: { $0.id == playerId })
        }

        var body: some View {
            if let player = player {
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
    }

    #Preview {
        List {
            PlayerInfoSection(playerId: "preview-id")
                .environmentObject(CloudKitManager())
        }
    }
#endif
