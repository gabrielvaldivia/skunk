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
            VStack(alignment: .leading, spacing: 4) {
                if !hideGameTitle, let game = match.game {
                    Text(game.title)
                        .font(.headline)
                }

                Text(match.date.formatted(date: .abbreviated, time: .shortened))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if !match.playerIDs.isEmpty {
                    HStack {
                        Text("\(match.playerIDs.count) players")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if let winnerID = match.winnerID,
                            let winner = cloudKitManager.players.first(where: { $0.id == winnerID })
                        {
                            Text("•")
                                .foregroundStyle(.secondary)
                            Text("Winner: \(winner.name)")
                                .font(.caption)
                                .foregroundStyle(.green)
                        }
                    }
                }

                HStack {
                    Text(match.status)
                        .font(.caption)
                        .foregroundStyle(statusColor)
                }
            }
        }

        private var statusColor: Color {
            switch match.status {
            case "pending": return .orange
            case "active": return .blue
            case "completed": return .green
            case "cancelled": return .red
            default: return .secondary
            }
        }
    }
#endif
