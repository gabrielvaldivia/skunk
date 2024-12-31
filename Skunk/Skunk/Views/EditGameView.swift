#if canImport(UIKit)
    import SwiftUI

    struct EditGameView: View {
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        let game: Game
        @State private var title: String
        @State private var isBinaryScore: Bool
        @State private var supportsMultipleRounds: Bool
        @State private var showingError = false
        @State private var errorMessage = ""
        @State private var minPlayers: Int
        @State private var maxPlayers: Int
        @State private var showingDeleteConfirmation = false
        @State private var creatorName: String?

        init(game: Game) {
            self.game = game
            _title = State(initialValue: game.title)
            _isBinaryScore = State(initialValue: game.isBinaryScore)
            _supportsMultipleRounds = State(initialValue: game.supportsMultipleRounds)
            _minPlayers = State(initialValue: game.supportedPlayerCounts.min() ?? 2)
            _maxPlayers = State(initialValue: game.supportedPlayerCounts.max() ?? 4)
        }

        private var formattedDate: String {
            guard let date = game.creationDate else { return "unknown date" }
            let dateFormatter = DateFormatter()
            dateFormatter.dateStyle = .long
            dateFormatter.timeStyle = .none
            return dateFormatter.string(from: date)
        }

        var body: some View {
            NavigationStack {
                Form {
                    Section {
                        TextField("Game Title", text: $title)
                    }

                    Toggle(
                        "Track Score",
                        isOn: Binding(
                            get: { !isBinaryScore },
                            set: { isBinaryScore = !$0 }
                        )
                    )
                    .toggleStyle(.switch)

                    Toggle("Multiple Rounds", isOn: $supportsMultipleRounds)
                        .toggleStyle(.switch)

                    Section("Player Count") {
                        Stepper(
                            "Minimum \(minPlayers) Players", value: $minPlayers, in: 1...maxPlayers)
                        Stepper(
                            "Maximum \(maxPlayers) Players", value: $maxPlayers, in: minPlayers...99
                        )
                    }

                    Section {
                        Button(role: .destructive) {
                            showingDeleteConfirmation = true
                        } label: {
                            Text("Delete Game")
                                .frame(maxWidth: .infinity)
                        }
                    }

                    if let creatorName = creatorName {
                        Section {
                            Text("Created by \(creatorName) on \(formattedDate)")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .navigationTitle("Edit Game")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            dismiss()
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            saveGame()
                        }
                        .disabled(title.isEmpty)
                    }
                }
                .alert("Error", isPresented: $showingError) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(errorMessage)
                }
                .confirmationDialog(
                    "Are you sure you want to delete this game?",
                    isPresented: $showingDeleteConfirmation,
                    titleVisibility: .visible
                ) {
                    Button("Delete", role: .destructive) {
                        deleteGame()
                    }
                } message: {
                    Text("This action cannot be undone.")
                }
                .task {
                    if let createdByID = game.createdByID,
                        let player = cloudKitManager.getPlayer(id: createdByID)
                    {
                        creatorName = player.name
                    }
                }
            }
        }

        private func saveGame() {
            var updatedGame = game
            updatedGame.title = title
            updatedGame.isBinaryScore = isBinaryScore
            updatedGame.supportsMultipleRounds = supportsMultipleRounds
            updatedGame.supportedPlayerCounts = Set(minPlayers...maxPlayers)

            Task {
                do {
                    try await cloudKitManager.saveGame(updatedGame)
                    print("Successfully updated game: \(title)")
                    dismiss()
                } catch {
                    errorMessage = error.localizedDescription
                    showingError = true
                    print("Failed to save game: \(error)")
                }
            }
        }

        private func deleteGame() {
            Task {
                do {
                    // Delete all matches associated with this game
                    if let matches = try? await cloudKitManager.fetchMatches(for: game) {
                        for match in matches {
                            try? await cloudKitManager.deleteMatch(match)
                        }
                    }

                    // Finally delete the game
                    try await cloudKitManager.deleteGame(game)
                    dismiss()
                } catch {
                    errorMessage = error.localizedDescription
                    showingError = true
                }
            }
        }
    }
#endif
