import CloudKit
import SwiftUI

#if canImport(UIKit)
    struct MatchDetailView: View {
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var match: Match
        @State private var showingError = false
        @State private var error: Error?

        init(match: Match) {
            _match = State(initialValue: match)
        }

        var body: some View {
            List {
                Section("Game Details") {
                    if let game = match.game {
                        HStack {
                            Text("Game")
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(game.title)
                                .font(.body)
                        }
                    }
                    HStack {
                        Text("Date")
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(match.date.formatted(date: .abbreviated, time: .shortened))
                            .font(.body)
                    }
                }

                Section("Players") {
                    if match.playerIDs.isEmpty {
                        Text("No players")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(match.playerOrder, id: \.self) { playerID in
                            if let player = cloudKitManager.players.first(where: {
                                $0.id == playerID
                            }) {
                                HStack {
                                    PlayerAvatar(player: player)
                                        .frame(width: 40, height: 40)

                                    Text(player.name)
                                        .font(.body)

                                    Spacer()

                                    if match.status == "completed" {
                                        if match.winnerID == player.id {
                                            Image(systemName: "crown.fill")
                                                .foregroundStyle(.yellow)
                                        }
                                    } else {
                                        Toggle(
                                            isOn: Binding(
                                                get: { match.winnerID == player.id },
                                                set: { isWinner in
                                                    var updatedMatch = match
                                                    updatedMatch.winnerID =
                                                        isWinner ? player.id : nil
                                                    updatedMatch.status =
                                                        isWinner ? "completed" : "active"
                                                    Task {
                                                        do {
                                                            try await cloudKitManager.saveMatch(
                                                                updatedMatch)
                                                            match = updatedMatch
                                                        } catch {
                                                            self.error = error
                                                            showingError = true
                                                        }
                                                    }
                                                }
                                            )
                                        ) {
                                            Text("Winner")
                                                .font(.subheadline)
                                        }
                                        .toggleStyle(.button)
                                        .buttonStyle(.bordered)
                                        .tint(match.winnerID == player.id ? .green : .gray)
                                    }
                                }
                            }
                        }
                    }
                }

                if match.isMultiplayer {
                    Section("Multiplayer Status") {
                        if match.invitedPlayerIDs.isEmpty {
                            Text("No invited players")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(match.invitedPlayerIDs, id: \.self) { playerID in
                                if let player = cloudKitManager.players.first(where: {
                                    $0.id == playerID
                                }) {
                                    HStack {
                                        Text(player.name)
                                        Spacer()
                                        if match.acceptedPlayerIDs.contains(playerID) {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundStyle(.green)
                                        } else {
                                            Text("Pending")
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if !match.isMultiplayer || match.status == "completed" {
                    Section {
                        Button(role: .destructive) {
                            Task {
                                try? await cloudKitManager.deleteMatch(match)
                                dismiss()
                            }
                        } label: {
                            Text("Delete Match")
                                .frame(maxWidth: .infinity, alignment: .center)
                        }
                    }
                }
            }
            .navigationTitle("Match Details")
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
        }
    }
#endif
