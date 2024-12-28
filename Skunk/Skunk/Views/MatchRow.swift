import CloudKit
import SwiftUI

#if canImport(UIKit)
    struct MatchRow: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        let match: Match
        let hideGameTitle: Bool

        init(match: Match, hideGameTitle: Bool = false) {
            self.match = match
            self.hideGameTitle = hideGameTitle
        }

        var body: some View {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    if !hideGameTitle, let game = match.game {
                        Text(game.title)
                            .font(.headline)
                    }

                    Text(match.date.formatted(date: .abbreviated, time: .shortened))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    if !match.playerIDs.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: -8) {
                                ForEach(match.playerIDs, id: \.self) { playerID in
                                    if let player = cloudKitManager.players.first(where: {
                                        $0.id == playerID
                                    }) {
                                        PlayerAvatar(player: player)
                                            .frame(width: 24, height: 24)
                                    } else {
                                        // Show a placeholder for players that haven't loaded yet
                                        Circle()
                                            .fill(Color.gray.opacity(0.3))
                                            .frame(width: 24, height: 24)
                                            .overlay(
                                                Text("?")
                                                    .font(.caption2)
                                                    .foregroundStyle(.secondary)
                                            )
                                    }
                                }
                            }
                        }
                        .task {
                            // Try to fetch any missing players
                            for playerID in match.playerIDs {
                                if !cloudKitManager.players.contains(where: { $0.id == playerID }) {
                                    if let player = try? await cloudKitManager.fetchPlayer(
                                        id: playerID)
                                    {
                                        print("Loaded player for match row: \(player.name)")
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer()

                // Show winner's profile photo if there is a winner
                if let winnerID = match.winnerID,
                    let winner = cloudKitManager.players.first(where: { $0.id == winnerID })
                {
                    if let photoData = winner.photoData,
                        let uiImage = UIImage(data: photoData)
                    {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 40, height: 40)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(winner.color, lineWidth: 2))
                    } else {
                        // Fallback to initials if no photo
                        ZStack {
                            Circle()
                                .fill(winner.color)
                                .frame(width: 40, height: 40)
                            Text(String(winner.name.prefix(1)))
                                .font(.headline)
                                .foregroundColor(.white)
                        }
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }
#endif
