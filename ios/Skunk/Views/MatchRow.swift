import CloudKit
import SwiftUI

#if canImport(UIKit)
    struct MatchRow: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        let match: Match
        var hideGameTitle: Bool = false

        private var matchDateDisplayString: String {
            let calendar = Calendar.current
            let today = calendar.startOfDay(for: Date())
            let matchDay = calendar.startOfDay(for: match.date)

            // Only show relative text if the match is within the last 30 days.
            let thirtyDaysAgo = calendar.date(byAdding: .day, value: -30, to: today) ?? today
            if matchDay < thirtyDaysAgo {
                return match.date.formatted(date: .abbreviated, time: .omitted)
            }

            let formatter = RelativeDateTimeFormatter()
            formatter.unitsStyle = .full
            return formatter.localizedString(for: match.date, relativeTo: Date())
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

                        if otherPlayers.isEmpty {
                            Text("\(winner.name)").fontWeight(.semibold) + Text(" won")
                        } else if otherPlayers.count == 1 {
                            if hideGameTitle {
                                Text("\(winner.name)").fontWeight(.semibold) + Text(" beat ")
                                    + Text("\(otherPlayers[0])").fontWeight(.semibold)
                            } else if let game = match.game {
                                Text("\(winner.name)").fontWeight(.semibold) + Text(" beat ")
                                    + Text("\(otherPlayers[0])").fontWeight(.semibold)
                                    + Text(" at ") + Text(game.title).fontWeight(.semibold)
                            }
                        } else if otherPlayers.count == 2 {
                            if hideGameTitle {
                                Text("\(winner.name)").fontWeight(.semibold) + Text(" beat ")
                                    + Text("\(otherPlayers[0])").fontWeight(.semibold)
                                    + Text(" and ")
                                    + Text("\(otherPlayers[1])").fontWeight(.semibold)
                            } else if let game = match.game {
                                Text("\(winner.name)").fontWeight(.semibold) + Text(" beat ")
                                    + Text("\(otherPlayers[0])").fontWeight(.semibold)
                                    + Text(" and ")
                                    + Text("\(otherPlayers[1])").fontWeight(.semibold)
                                    + Text(" at ") + Text(game.title).fontWeight(.semibold)
                            }
                        } else {
                            let allButLast = otherPlayers.dropLast().joined(separator: ", ")
                            let last = otherPlayers.last!
                            if hideGameTitle {
                                Text("\(winner.name)").fontWeight(.semibold) + Text(" beat ")
                                    + Text(allButLast).fontWeight(.semibold) + Text(", and ")
                                    + Text(last).fontWeight(.semibold)
                            } else if let game = match.game {
                                Text("\(winner.name)").fontWeight(.semibold) + Text(" beat ")
                                    + Text(allButLast).fontWeight(.semibold) + Text(", and ")
                                    + Text(last).fontWeight(.semibold)
                                    + Text(" at ") + Text(game.title).fontWeight(.semibold)
                            }
                        }
                    }

                    Text(matchDateDisplayString)
                        .font(.caption)
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
