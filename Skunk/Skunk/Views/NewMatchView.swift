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

        @Query(sort: \Match.date, order: .reverse) private var matches: [Match]
        @Query private var allPlayers: [Player]

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

        // Get the default players from the last match, with current user as player 1
        private var defaultPlayers: [Player?] {
            var players = Array(repeating: nil as Player?, count: self.players.count)

            // Set current user as player 1
            if let userID = authManager.userID {
                players[0] = allPlayers.first { "\($0.persistentModelID)" == userID }
            }

            // Fill remaining slots with players from last match
            if let lastMatch = game.matches?.sorted(by: { $0.date > $1.date }).first {
                let lastMatchPlayers = lastMatch.players ?? []
                // Skip any player that matches the current user to avoid duplicates
                let remainingPlayers = lastMatchPlayers.filter { player in
                    guard let userID = authManager.userID else { return true }
                    return "\(player.persistentModelID)" != userID
                }

                // Fill remaining slots starting from index 1
                for (index, player) in remainingPlayers.prefix(players.count - 1).enumerated() {
                    players[index + 1] = player
                }
            }

            return players
        }

        var body: some View {
            NavigationStack {
                Form {
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
                    .onDelete { indexSet in
                        guard let minPlayers = game.supportedPlayerCounts.min(),
                            players.count > minPlayers,
                            !indexSet.contains(0),  // Prevent deleting player 1
                            indexSet.max() ?? 0 < players.count  // Ensure all indices are valid
                        else { return }

                        withAnimation {
                            players.remove(atOffsets: indexSet)
                            scores.remove(atOffsets: indexSet)
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
            return !players.contains(nil)
                && Set(players.compactMap { $0?.id }).count == players.count
                && (!game.isBinaryScore || Set(scores).count > 1)
        }

        private func saveMatch() {
            let match = Match(game: game)
            match.createdByID = authManager.userID
            match.status = "completed"
            modelContext.insert(match)

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
