import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct MatchDetailView: View {
        let match: Match
        @Environment(\.modelContext) private var modelContext
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var authManager: AuthenticationManager

        private var isCurrentUserInvited: Bool {
            guard let userID = authManager.userID else { return false }
            return match.invitedPlayerIDs.contains(userID)
        }

        private var canJoinMatch: Bool {
            guard let userID = authManager.userID else { return false }
            return match.isMultiplayer && match.status == "pending" && isCurrentUserInvited
                && !match.acceptedPlayerIDs.contains(userID)
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

        private func playerColor(for player: Player) -> Color {
            if let colorData = player.colorData,
                let uiColor = try? NSKeyedUnarchiver.unarchivedObject(
                    ofClass: UIColor.self, from: colorData)
            {
                return Color(uiColor: uiColor)
            }
            // Generate a consistent color based on the name
            let hash = abs(player.name?.hashValue ?? 0)
            let hue = Double(hash % 255) / 255.0
            return Color(hue: hue, saturation: 0.7, brightness: 0.9)
        }

        private func playerView(_ player: Player) -> some View {
            HStack(spacing: 0) {
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
                            name: player.name ?? "",
                            size: 40,
                            color: playerColor(for: player)
                        )
                    }

                    Text(player.name ?? "")
                        .font(.headline)
                        .padding(.leading, 8)
                }
                .padding(.leading, -12)

                Spacer()

                if !match.isMultiplayer || match.status == "completed" {
                    if let game = match.game, game.isBinaryScore {
                        Toggle(
                            "",
                            isOn: Binding(
                                get: { "\(player.persistentModelID)" == match.winnerID },
                                set: { isWinner in
                                    if isWinner {
                                        match.winnerID = "\(player.persistentModelID)"
                                        try? modelContext.save()
                                    } else if match.winnerID == "\(player.persistentModelID)" {
                                        match.winnerID = nil
                                        try? modelContext.save()
                                    }
                                }
                            )
                        )
                    } else {
                        if "\(player.persistentModelID)" == match.winnerID {
                            Text("Winner")
                                .font(.subheadline)
                                .foregroundStyle(.green)
                        }
                    }
                }
            }
        }

        var body: some View {
            List {
                if match.isMultiplayer {
                    Section {
                        HStack {
                            Text(match.status.capitalized)
                                .font(.headline)
                                .foregroundStyle(statusColor)
                            Spacer()
                            if canJoinMatch {
                                Button("Join Match") {
                                    if let userID = authManager.userID {
                                        match.acceptedPlayerIDs.append(userID)
                                        try? modelContext.save()
                                    }
                                }
                            }
                        }
                    }
                }

                Section("Players") {
                    ForEach(match.orderedPlayers) { player in
                        playerView(player)
                    }
                }

                if !match.isMultiplayer || match.status == "completed" {
                    Section {
                        Button(role: .destructive) {
                            modelContext.delete(match)
                            try? modelContext.save()
                            dismiss()
                        } label: {
                            Text("Delete Match")
                        }
                    }
                }
            }
            .navigationTitle("Match Details")
        }
    }
#endif
