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
                if let winner = cloudKitManager.players.first(where: { $0.id == match.winnerID }
                ) {
                    PlayerAvatar(player: winner, size: 40)
                        .clipShape(Circle())
                }

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
                            Text("\(winner.name) won at \(game.title)")
                                .font(.body)
                        } else if otherPlayers.count == 1 {
                            Text("\(winner.name) beat \(otherPlayers[0]) at \(game.title)")
                                .font(.body)
                        } else if otherPlayers.count == 2 {
                            Text(
                                "\(winner.name) beat \(otherPlayers[0]) and \(otherPlayers[1]) at \(game.title)"
                            )
                            .font(.body)
                        } else {
                            let allButLast = otherPlayers.dropLast().joined(separator: ", ")
                            let last = otherPlayers.last!
                            Text(
                                "\(winner.name) beat \(allButLast), and \(last) at \(game.title)"
                            )
                            .font(.body)
                        }
                    }

                    Text(relativeTimeString)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
#endif
