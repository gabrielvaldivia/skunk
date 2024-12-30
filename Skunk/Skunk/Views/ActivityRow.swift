#if canImport(UIKit)
    import SwiftUI
    import CloudKit

    struct ActivityRow: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        let match: Match

        private var relativeTimeString: String {
            let timeInterval = Date().timeIntervalSince(match.date)
            if timeInterval < 60 {  // Less than a minute ago
                return "just now"
            } else {
                let formatter = RelativeDateTimeFormatter()
                formatter.unitsStyle = .abbreviated
                return formatter.localizedString(for: match.date, relativeTo: Date())
            }
        }

        var body: some View {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    if let winner = cloudKitManager.players.first(where: {
                        $0.id == match.winnerID
                    }),
                        let game = match.game
                    {
                        let otherPlayers = match.playerIDs
                            .filter { $0 != winner.id }
                            .compactMap { id in cloudKitManager.getPlayer(id: id) }
                            .map { $0.name }

                        if otherPlayers.isEmpty {
                            Text(winner.name).fontWeight(.semibold) + Text(" won ")
                                + Text(game.title).fontWeight(.semibold)
                        } else if otherPlayers.count == 1 {
                            Text(winner.name).fontWeight(.semibold) + Text(" beat ")
                                + Text(otherPlayers[0]).fontWeight(.semibold) + Text(" at ")
                                + Text(game.title).fontWeight(.semibold)
                        } else if otherPlayers.count == 2 {
                            Text(winner.name).fontWeight(.semibold) + Text(" beat ")
                                + Text(otherPlayers[0]).fontWeight(.semibold) + Text(" and ")
                                + Text(otherPlayers[1]).fontWeight(.semibold) + Text(" at ")
                                + Text(game.title).fontWeight(.semibold)
                        } else {
                            let allButLast = otherPlayers.dropLast().joined(separator: ", ")
                            let last = otherPlayers.last!
                            Text(winner.name).fontWeight(.semibold) + Text(" beat ")
                                + Text(allButLast).fontWeight(.semibold) + Text(", and ")
                                + Text(last).fontWeight(.semibold) + Text(" at ")
                                + Text(game.title).fontWeight(.semibold)
                        }
                    }

                    Text(relativeTimeString)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if let winner = cloudKitManager.players.first(where: { $0.id == match.winnerID }
                ) {
                    PlayerAvatar(player: winner, size: 40)
                        .clipShape(Circle())
                }
            }
        }
    }
#endif
