#if canImport(UIKit)
    import SwiftUI

    struct AddGameView: View {
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @EnvironmentObject private var authManager: AuthenticationManager

        @State private var title = ""
        @State private var isBinaryScore = true
        @State private var showingError = false
        @State private var errorMessage = ""
        @State private var minPlayers = 2
        @State private var maxPlayers = 4
        @State private var countAllScores = true
        @State private var countLosersOnly = false
        @State private var highestScoreWins = true
        @State private var highestRoundScoreWins = true

        var body: some View {
            NavigationStack {
                Form {
                    GameSettingsView(
                        title: $title,
                        isBinaryScore: $isBinaryScore,
                        minPlayers: $minPlayers,
                        maxPlayers: $maxPlayers,
                        countAllScores: $countAllScores,
                        countLosersOnly: $countLosersOnly,
                        highestScoreWins: $highestScoreWins,
                        highestRoundScoreWins: $highestRoundScoreWins,
                        autofocusTitle: true
                    )
                }
                .navigationTitle("New Game")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            dismiss()
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Add") {
                            addGame()
                        }
                        .disabled(title.isEmpty)
                    }
                }
                .alert("Error", isPresented: $showingError) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(errorMessage)
                }
            }
        }

        private func addGame() {
            let supportedCounts = Set(minPlayers...maxPlayers)
            let game = Game(
                title: title,
                isBinaryScore: isBinaryScore,
                supportedPlayerCounts: supportedCounts,
                createdByID: authManager.userID,
                countAllScores: !isBinaryScore ? countAllScores : false,
                countLosersOnly: !isBinaryScore ? countLosersOnly : false,
                highestScoreWins: !isBinaryScore ? highestScoreWins : true,
                highestRoundScoreWins: !isBinaryScore ? highestRoundScoreWins : true
            )

            Task {
                do {
                    try await cloudKitManager.saveGame(game)
                    dismiss()
                } catch {
                    errorMessage = error.localizedDescription
                    showingError = true
                }
            }
        }
    }
#endif
