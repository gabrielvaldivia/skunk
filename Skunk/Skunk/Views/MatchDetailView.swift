import SwiftData
import SwiftUI

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
        // Generate a consistent color based on the name
        let hash = abs(player.name?.hashValue ?? 0)
        let hue = Double(hash % 255) / 255.0
        return Color(hue: hue, saturation: 0.7, brightness: 0.9)
    }

    private func playerView(_ player: Player) -> some View {
        Button(action: {
            if !match.isMultiplayer || match.status == "completed" {
                match.winnerID = "\(player.persistentModelID)"
                try? modelContext.save()
            }
        }) {
            HStack {
                if player.photoData != nil {
                    Circle()
                        .fill(playerColor(for: player))
                        .frame(width: 40, height: 40)
                        .overlay {
                            Image(systemName: "person.fill")
                                .foregroundStyle(.white)
                        }
                } else {
                    PlayerInitialsView(
                        name: player.name ?? "",
                        size: 40,
                        color: playerColor(for: player)
                    )
                }

                VStack(alignment: .leading) {
                    Text(player.name ?? "")
                        .font(.headline)

                    if player.appleUserID != nil {
                        Text(player.isOnline ? "Online" : "Offline")
                            .font(.caption)
                            .foregroundStyle(player.isOnline ? .green : .secondary)
                    }
                }

                Spacer()

                if "\(player.persistentModelID)" == match.winnerID {
                    Text("Winner")
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }
            }
        }
    }

    private func playerImage(_ player: Player) -> AnyView {
        if player.photoData != nil {
            return AnyView(
                Circle()
                    .fill(playerColor(for: player))
                    .frame(width: 40, height: 40)
                    .overlay {
                        Image(systemName: "person.fill")
                            .foregroundStyle(.white)
                    }
            )
        } else {
            return AnyView(
                PlayerInitialsView(
                    name: player.name ?? "",
                    size: 40,
                    color: playerColor(for: player)
                )
            )
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
