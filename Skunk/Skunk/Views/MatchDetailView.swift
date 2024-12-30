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
        @State private var showingDeleteConfirmation = false

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
                                .fontWeight(.bold)
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
                                    HStack(spacing: 12) {
                                        PlayerAvatar(player: player)
                                            .frame(width: 32, height: 32)

                                        Text(player.name)
                                            .font(.body)
                                    }

                                    Spacer()

                                    if let game = match.game, !game.isBinaryScore,
                                        let playerIndex = match.playerIDs.firstIndex(of: player.id),
                                        playerIndex < match.scores.count
                                    {
                                        Text("\(match.scores[playerIndex])")
                                            .font(.body)
                                            .foregroundStyle(.secondary)
                                            .padding(.trailing, 8)
                                    }

                                    if match.status == "completed" {
                                        if match.winnerID == player.id {
                                            Image(systemName: "crown.fill")
                                                .foregroundStyle(.yellow)
                                        }
                                    } else {
                                        Image(systemName: "crown.fill")
                                            .foregroundStyle(
                                                match.winnerID == player.id
                                                    ? .yellow : .gray.opacity(0.3)
                                            )
                                            .onTapGesture {
                                                var updatedMatch = match
                                                updatedMatch.winnerID =
                                                    match.winnerID == player.id ? nil : player.id
                                                updatedMatch.status =
                                                    updatedMatch.winnerID != nil
                                                    ? "completed" : "active"
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
                                    }
                                }
                                .padding(.vertical, 8)
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
                            showingDeleteConfirmation = true
                        } label: {
                            if isLoading {
                                ProgressView()
                                    .frame(maxWidth: .infinity, alignment: .center)
                            } else {
                                Text("Delete Match")
                                    .frame(maxWidth: .infinity, alignment: .center)
                            }
                        }
                        .disabled(isLoading)
                        .confirmationDialog(
                            "Delete Match",
                            isPresented: $showingDeleteConfirmation,
                            titleVisibility: .visible
                        ) {
                            Button("Delete", role: .destructive) {
                                Task {
                                    isLoading = true
                                    do {
                                        try await cloudKitManager.deleteMatch(match)
                                        isLoading = false
                                        dismiss()
                                    } catch {
                                        isLoading = false
                                        self.error = error
                                        showingError = true
                                    }
                                }
                            }
                            Button("Cancel", role: .cancel) {}
                        } message: {
                            Text(
                                "Are you sure you want to delete this match? This action cannot be undone."
                            )
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
                // Use cached players if available
                let players = try await cloudKitManager.fetchPlayers(forceRefresh: false)
                print("Loaded \(players.count) players")
                print("Available player IDs: \(players.map { $0.id })")

                if let game = match.game {
                    print("Fetching matches for game: \(game.id)")
                    let matches = try await cloudKitManager.fetchMatches(for: game)
                    print("Found \(matches.count) matches")
                    if let updatedMatch = matches.first(where: { $0.id == match.id }) {
                        print("Updating match with \(updatedMatch.playerIDs.count) players")

                        // Check for missing players
                        let missingPlayerIDs = updatedMatch.playerIDs.filter { playerID in
                            !cloudKitManager.players.contains { $0.id == playerID }
                        }

                        // Only force refresh if we're missing players
                        if !missingPlayerIDs.isEmpty {
                            print("Fetching missing players")
                            _ = try await cloudKitManager.fetchPlayers(forceRefresh: true)
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
