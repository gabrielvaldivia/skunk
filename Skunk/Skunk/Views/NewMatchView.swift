import CloudKit
import SwiftUI

#if canImport(UIKit)
    struct NewMatchView: View {
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @EnvironmentObject private var authManager: AuthenticationManager

        let game: Game
        @State private var players: [Player?]
        @State private var scores: [Int]
        @State private var currentPlayerCount: Int
        @State private var allPlayers: [Player] = []
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false
        @State private var selectedWinnerIndex: Int?

        init(game: Game) {
            self.game = game
            let minPlayerCount = game.supportedPlayerCounts.min() ?? 2
            _currentPlayerCount = State(initialValue: minPlayerCount)
            _players = State(initialValue: Array(repeating: nil, count: minPlayerCount))
            _scores = State(initialValue: Array(repeating: 0, count: minPlayerCount))
        }

        var body: some View {
            NavigationStack {
                Form {
                    Section("Players") {
                        ForEach(Array(players.enumerated()), id: \.offset) { index, player in
                            HStack {
                                if let player = player {
                                    Text(player.name)

                                    Spacer()

                                    Toggle(
                                        "",
                                        isOn: Binding(
                                            get: { selectedWinnerIndex == index },
                                            set: { isWinner in
                                                selectedWinnerIndex = isWinner ? index : nil
                                            }
                                        )
                                    )
                                    .tint(.green)
                                } else {
                                    Menu {
                                        ForEach(availablePlayers) { player in
                                            Button(player.name) {
                                                players[index] = player
                                            }
                                        }
                                    } label: {
                                        Text("Select Player")
                                            .foregroundStyle(.secondary)
                                    }
                                }

                                if index >= game.supportedPlayerCounts.min() ?? 2 {
                                    Button(role: .destructive) {
                                        players.remove(at: index)
                                        scores.remove(at: index)
                                        if selectedWinnerIndex == index {
                                            selectedWinnerIndex = nil
                                        }
                                    } label: {
                                        Image(systemName: "minus.circle.fill")
                                            .foregroundStyle(.red)
                                    }
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
                .task {
                    await loadPlayers()
                }
                .alert("Error", isPresented: $showingError) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(error?.localizedDescription ?? "An unknown error occurred")
                }
            }
        }

        private var availablePlayers: [Player] {
            allPlayers.filter { player in
                !players.compactMap { $0 }.contains { $0.id == player.id }
            }
        }

        private var canSave: Bool {
            let filledPlayers = players.compactMap { $0 }
            return !filledPlayers.isEmpty
                && filledPlayers.count >= (game.supportedPlayerCounts.min() ?? 2)
        }

        private func loadPlayers() async {
            isLoading = true
            do {
                allPlayers = try await cloudKitManager.fetchPlayers()

                // Set default players
                if let currentUser = allPlayers.first(where: {
                    $0.appleUserID == authManager.userID
                }) {
                    players[0] = currentUser
                }
            } catch {
                self.error = error
                showingError = true
            }
            isLoading = false
        }

        private func saveMatch() {
            Task {
                do {
                    var match = Match(date: Date(), createdByID: authManager.userID, game: game)
                    match.playerIDs = players.compactMap { $0?.id }
                    match.playerOrder = match.playerIDs
                    match.status = selectedWinnerIndex != nil ? "completed" : "active"

                    if let winnerIndex = selectedWinnerIndex,
                        let winner = players[winnerIndex]
                    {
                        match.winnerID = winner.id
                    }

                    try await cloudKitManager.saveMatch(match)
                    await MainActor.run {
                        dismiss()
                    }
                } catch {
                    await MainActor.run {
                        self.error = error
                        showingError = true
                    }
                }
            }
        }
    }
#endif
