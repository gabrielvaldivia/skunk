import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct NewMatchView: View {
        @Environment(\.modelContext) private var modelContext
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var authManager: AuthenticationManager

        let game: Game
        @State private var players: [Player?]
        @State private var scores: [Int]
        @State private var currentPlayerCount: Int
        @State private var isMultiplayer = false
        @State private var invitedPlayers: Set<Player> = []

        @Query(sort: \Match.date, order: .reverse) private var matches: [Match]
        @Query private var allPlayers: [Player]

        private var availablePlayers: [Player] {
            allPlayers.filter { player in
                player.appleUserID.flatMap { id in
                    id != authManager.userID
                } == true
            }
        }

        init(game: Game) {
            self.game = game
            let lastMatch = game.matches?.sorted(by: { $0.date > $1.date }).first
            let lastPlayerCount = lastMatch?.players?.count
            let minPlayerCount = game.supportedPlayerCounts.min() ?? 2
            let initialPlayerCount = lastPlayerCount ?? minPlayerCount

            _currentPlayerCount = State(initialValue: initialPlayerCount)
            _players = State(initialValue: Array(repeating: nil, count: initialPlayerCount))
            _scores = State(initialValue: Array(repeating: 0, count: initialPlayerCount))
        }

        // Get the default players from the last match
        private var defaultPlayers: [Player?] {
            if let lastMatch = game.matches?.sorted(by: { $0.date > $1.date }).first {
                return Array((lastMatch.players ?? []).prefix(players.count))
            }
            return Array(repeating: nil, count: players.count)
        }

        var body: some View {
            NavigationStack {
                Form {
                    if authManager.isAuthenticated {
                        Section {
                            Toggle("Multiplayer Match", isOn: $isMultiplayer)
                        }
                    }

                    if isMultiplayer {
                        Section("Invite Players") {
                            if availablePlayers.isEmpty {
                                Text("No online players available")
                                    .foregroundStyle(.secondary)
                            } else {
                                ForEach(availablePlayers) { player in
                                    PlayerRow(player: player)
                                        .badge(invitedPlayers.contains(player) ? "Invited" : nil)
                                        .onTapGesture {
                                            if invitedPlayers.contains(player) {
                                                invitedPlayers.remove(player)
                                            } else {
                                                invitedPlayers.insert(player)
                                            }
                                        }
                                }
                            }
                        }
                    } else {
                        ForEach(players.indices, id: \.self) { index in
                            HStack(spacing: 0) {
                                Picker("Player \(index + 1)", selection: $players[index]) {
                                    Text("Select Player").tag(nil as Player?)
                                    ForEach(
                                        allPlayers.filter { player in
                                            !players.contains { $0?.id == player.id }
                                                || players[index]?.id == player.id
                                        }
                                    ) { player in
                                        Text(player.name ?? "").tag(player as Player?)
                                    }
                                }
                                .labelsHidden()
                                .padding(.leading, -12)

                                Spacer()

                                if game.isBinaryScore {
                                    Toggle(
                                        "",
                                        isOn: Binding(
                                            get: { scores[index] == 1 },
                                            set: { scores[index] = $0 ? 1 : 0 }
                                        )
                                    )
                                } else {
                                    Stepper(
                                        "",
                                        value: $scores[index],
                                        in: 0...Int.max
                                    )
                                    Text("\(scores[index])")
                                        .frame(width: 40)
                                }
                            }
                        }

                        if game.supportedPlayerCounts.contains(players.count + 1) {
                            Button(action: {
                                players.append(nil)
                                scores.append(0)
                            }) {
                                Text("Add Player")
                            }
                        }
                    }
                }
                .navigationTitle("New Match")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            dismiss()
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            saveMatch()
                        }
                        .disabled(!canSave)
                    }
                }
                .onAppear {
                    // Set default players on appear
                    let defaults = defaultPlayers
                    for (index, player) in defaults.enumerated() where players[index] == nil {
                        players[index] = player
                    }
                }
            }
        }

        private var canSave: Bool {
            if isMultiplayer {
                return !invitedPlayers.isEmpty
            } else {
                return !players.contains(nil)
                    && Set(players.compactMap { $0?.id }).count == players.count
                    && (!game.isBinaryScore || Set(scores).count > 1)
            }
        }

        private func saveMatch() {
            let match = Match(game: game)
            match.isMultiplayer = isMultiplayer
            match.createdByID = authManager.userID
            modelContext.insert(match)

            if isMultiplayer {
                // Set up multiplayer match
                match.status = "pending"
                match.invitedPlayerIDs = invitedPlayers.compactMap { $0.appleUserID }

                // Add current user as first player
                if let currentUserID = authManager.userID,
                    let currentPlayer = try? modelContext.fetch(
                        FetchDescriptor<Player>(
                            predicate: #Predicate<Player> { $0.appleUserID == currentUserID }
                        )
                    ).first
                {
                    match.addPlayer(currentPlayer)
                    if currentPlayer.matches == nil {
                        currentPlayer.matches = []
                    }
                    currentPlayer.matches?.append(match)
                }
            } else {
                // Set up local match
                match.status = "completed"

                // Set up relationships
                for player in players.compactMap({ $0 }) {
                    match.addPlayer(player)
                    if player.matches == nil {
                        player.matches = []
                    }
                    player.matches?.append(match)
                }

                // Set winner based on scores
                if let maxScore = scores.max(),
                    let winnerIndex = scores.firstIndex(of: maxScore),
                    let winner = players[winnerIndex]
                {
                    match.winnerID = "\(winner.persistentModelID)"
                }

                // Save scores for point-based games
                if !game.isBinaryScore {
                    for (index, player) in players.enumerated() {
                        if let player = player {
                            let scoreObj = Score(
                                player: player, match: match, points: scores[index])
                            if match.scores == nil {
                                match.scores = []
                            }
                            match.scores?.append(scoreObj)
                            modelContext.insert(scoreObj)
                        }
                    }
                }
            }

            match.game = game
            if game.matches == nil {
                game.matches = []
            }
            game.matches?.append(match)

            try? modelContext.save()
            dismiss()
        }
    }
#endif
