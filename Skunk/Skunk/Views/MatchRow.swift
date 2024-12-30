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
            HStack {
                // Match info
                VStack(alignment: .leading, spacing: 4) {
                    if let winner = cloudKitManager.players.first(where: {
                        $0.id == match.winnerID
                    }
                    ) {
                        let otherPlayers = match.playerIDs
                            .filter { $0 != winner.id }
                            .compactMap { id in cloudKitManager.getPlayer(id: id) }
                            .map { $0.name }

                        if !otherPlayers.isEmpty {
                            Text("\(winner.name)").fontWeight(.semibold) + Text(" beat ")
                                + Text("\(otherPlayers[0])").fontWeight(.semibold)
                                .font(.body)
                        }
                    }

                    Text(relativeTimeString)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                // Avatar
                if let winner = cloudKitManager.players.first(where: { $0.id == match.winnerID }
                ) {
                    PlayerAvatar(player: winner, size: 40)
                        .clipShape(Circle())
                }
            }
            .padding(.vertical, 4)
        }
    }
#endif
