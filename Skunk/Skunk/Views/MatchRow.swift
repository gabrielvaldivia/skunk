import CloudKit
import SwiftUI

#if canImport(UIKit)
    struct MatchRow: View {
        let match: Match
        let hideGameTitle: Bool
        @State private var winner: Player?
        @StateObject private var cloudKitManager = CloudKitManager.shared

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
                }

                Spacer()

                // Show winner's profile photo if there is a winner
                if let winner = winner {
                    PlayerAvatar(player: winner, size: 40)
                        .clipShape(Circle())
                }
            }
            .padding(.vertical, 4)
            .task {
                if let winnerID = match.winnerID {
                    winner = cloudKitManager.getPlayer(id: winnerID)
                }
            }
        }
    }
#endif
