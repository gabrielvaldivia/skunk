import CloudKit
import SwiftUI

extension Sequence {
    func uniqued<T: Hashable>(by keyPath: KeyPath<Element, T>) -> [Element] {
        var seen = Set<T>()
        return filter { seen.insert($0[keyPath: keyPath]).inserted }
    }
}

#if canImport(UIKit)
    struct NewMatchView: View {
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @EnvironmentObject private var authManager: AuthenticationManager
        @AppStorage("lastMatchPlayerIDs") private var lastMatchPlayerIDsString: String = "[]"

        private var lastMatchPlayerIDs: [String] {
            (try? JSONDecoder().decode([String].self, from: Data(lastMatchPlayerIDsString.utf8)))
                ?? []
        }

        private func setLastMatchPlayerIDs(_ ids: [String]) {
            if let encoded = try? JSONEncoder().encode(ids),
                let string = String(data: encoded, encoding: .utf8)
            {
                lastMatchPlayerIDsString = string
            }
        }

        let game: Game
        let onMatchSaved: ((Match) -> Void)?
        @State private var players: [Player?]
        @State private var scores: [Int]
        @State private var currentPlayerCount: Int
        @State private var allPlayers: [Player] = []
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false
        @State private var selectedWinnerIndex: Int?

        init(game: Game, onMatchSaved: ((Match) -> Void)? = nil) {
            self.game = game
            self.onMatchSaved = onMatchSaved
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
                                        HStack {
                                            Text("Select Player")
                                                .foregroundColor(.secondary)
                                            Image(systemName: "chevron.up.chevron.down")
                                                .foregroundColor(.secondary)
                                        }
                                    }
                                }
                            }
                        }
                        .onDelete { indexSet in
                            guard let index = indexSet.first,
                                index >= (game.supportedPlayerCounts.min() ?? 2)
                            else { return }
                            players.remove(at: index)
                            scores.remove(at: index)
                            if selectedWinnerIndex == index {
                                selectedWinnerIndex = nil
                            } else if let winner = selectedWinnerIndex, winner > index {
                                selectedWinnerIndex = winner - 1
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
            let available = allPlayers.filter { player in
                !players.compactMap { $0 }.contains { $0.id == player.id }
            }
            print("Available players: \(available.map { $0.name })")
            return available
        }

        private var canSave: Bool {
            let filledPlayers = players.compactMap { $0 }
            print("Filled players: \(filledPlayers.map { $0.name })")
            return !filledPlayers.isEmpty
                && filledPlayers.count >= (game.supportedPlayerCounts.min() ?? 2)
        }

        private func loadPlayers() async {
            isLoading = true
            do {
                print("Loading all players...")
                allPlayers = try await cloudKitManager.fetchPlayers()

                // Filter to only include real users (players with Apple IDs)
                guard let userID = authManager.userID else { return }
                allPlayers = allPlayers.filter { player in
                    player.appleUserID != nil  // Is a real user
                        || (player.ownerID == userID && player.appleUserID == nil)  // Or is a managed player
                }

                // Sort to match PlayersView order but without sections
                let currentUser = allPlayers.first { $0.appleUserID == userID }
                let managedPlayers = allPlayers.filter { player in
                    player.ownerID == userID && player.appleUserID != userID
                }
                let otherUsers = allPlayers.filter { player in
                    player.appleUserID != nil && player.appleUserID != userID
                        && player.ownerID != userID
                }

                // Reorder allPlayers to match the structure
                var orderedPlayers: [Player] = []
                if let currentUser = currentUser {
                    orderedPlayers.append(currentUser)
                }
                orderedPlayers.append(contentsOf: managedPlayers)
                orderedPlayers.append(contentsOf: otherUsers)
                allPlayers = orderedPlayers

                print("Loaded \(allPlayers.count) players: \(allPlayers.map { $0.name })")

                // If we have last match players, use those
                if !lastMatchPlayerIDs.isEmpty {
                    print("Found last match players: \(lastMatchPlayerIDs)")
                    // Fill in as many slots as we have players and supported count allows
                    let lastPlayers = lastMatchPlayerIDs.compactMap { id in
                        allPlayers.first { $0.id == id }
                    }

                    for (index, player) in lastPlayers.enumerated() {
                        if index < players.count {
                            players[index] = player
                        }
                    }
                } else {
                    // First time - just set current user as player 1
                    if let currentUser = allPlayers.first(where: {
                        $0.appleUserID == authManager.userID
                    }) {
                        print("Setting current user: \(currentUser.name)")
                        players[0] = currentUser
                    }
                }

                print("Initial players array: \(players.map { $0?.name ?? "nil" })")
            } catch {
                print("Error loading players: \(error.localizedDescription)")
                self.error = error
                showingError = true
            }
            isLoading = false
        }

        private func saveMatch() {
            Task {
                do {
                    var match = Match(date: Date(), createdByID: authManager.userID, game: game)
                    let filledPlayers = players.compactMap { $0 }

                    // Save the current players as last players
                    setLastMatchPlayerIDs(filledPlayers.map { $0.id })

                    // Use the existing player IDs directly
                    match.playerIDs = filledPlayers.map { $0.id }
                    match.playerOrder = match.playerIDs
                    match.status = selectedWinnerIndex != nil ? "completed" : "active"

                    if let winnerIndex = selectedWinnerIndex,
                        let winner = players[winnerIndex]
                    {
                        match.winnerID = winner.id
                    }

                    try await cloudKitManager.saveMatch(match)
                    onMatchSaved?(match)
                    dismiss()
                } catch {
                    print("Error saving match: \(error.localizedDescription)")
                    self.error = error
                    showingError = true
                }
            }
        }
    }
#endif
