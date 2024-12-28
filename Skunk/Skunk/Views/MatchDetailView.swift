import CloudKit
import SwiftUI

#if canImport(UIKit)
    struct MatchDetailView: View {
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var match: Match
        @State private var showingError = false
        @State private var error: Error?
        @State private var isLoading = false

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
                    if isLoading {
                        ProgressView()
                    } else if match.playerIDs.isEmpty {
                        Text("No players")
                            .foregroundStyle(.secondary)
                    } else {
                        let playerList =
                            match.playerOrder.isEmpty ? match.playerIDs : match.playerOrder
                        ForEach(playerList, id: \.self) { playerID in
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
            .task {
                await loadData()
            }
            .refreshable {
                await loadData()
            }
        }

        private func loadData() async {
            isLoading = true
            do {
                print("Loading players for match: \(match.id)")
                let players = try await cloudKitManager.fetchPlayers()
                print("Loaded \(players.count) players")
                print("Available player IDs: \(players.map { $0.id })")

                if let game = match.game {
                    print("Fetching matches for game: \(game.id)")
                    let matches = try await cloudKitManager.fetchMatches(for: game)
                    print("Found \(matches.count) matches")
                    if let updatedMatch = matches.first(where: { $0.id == match.id }) {
                        print("Updating match with \(updatedMatch.playerIDs.count) players")

                        // Ensure all players in the match are loaded
                        for playerID in updatedMatch.playerIDs {
                            if !cloudKitManager.players.contains(where: { $0.id == playerID }) {
                                print("Attempting to fetch missing player: \(playerID)")
                                // Try to fetch the specific player if not found
                                if let player = try? await cloudKitManager.fetchPlayer(id: playerID)
                                {
                                    print("Successfully fetched missing player: \(player.name)")
                                } else {
                                    print("Failed to fetch player with ID: \(playerID)")
                                }
                            }
                        }

                        match = updatedMatch
                    }
                }

                // Debug print player IDs and found players
                print("Match player IDs: \(match.playerIDs)")
                for playerID in match.playerIDs {
                    if let player = cloudKitManager.players.first(where: { $0.id == playerID }) {
                        print("Found player: \(player.name) for ID: \(playerID)")
                    } else {
                        print("Could not find player for ID: \(playerID)")
                    }
                }
            } catch {
                print("Error loading data: \(error.localizedDescription)")
                self.error = error
                showingError = true
            }
            isLoading = false
        }
    }
#endif
