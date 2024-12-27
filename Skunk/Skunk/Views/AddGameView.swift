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
        @FocusState private var isTitleFocused: Bool

        var body: some View {
            NavigationStack {
                Form {
                    TextField("Game Title", text: $title)
                        .focused($isTitleFocused)

                    Toggle(
                        "Track Score",
                        isOn: Binding(
                            get: { !isBinaryScore },
                            set: { isBinaryScore = !$0 }
                        )
                    )
                    .toggleStyle(.switch)

                    Section("Player Count") {
                        Stepper(
                            "Minimum \(minPlayers) Players", value: $minPlayers, in: 1...maxPlayers)
                        Stepper(
                            "Maximum \(maxPlayers) Players", value: $maxPlayers, in: minPlayers...99
                        )
                    }
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
                .onAppear {
                    isTitleFocused = true
                }
            }
        }

        private func addGame() {
            let supportedCounts = Set(minPlayers...maxPlayers)
            var game = Game(
                title: title,
                isBinaryScore: isBinaryScore,
                supportedPlayerCounts: supportedCounts,
                createdByID: authManager.userID
            )

            Task {
                do {
                    try await cloudKitManager.saveGame(game)
                    print("Successfully added game: \(title)")
                    dismiss()
                } catch {
                    errorMessage = error.localizedDescription
                    showingError = true
                    print("Failed to save game: \(error)")
                }
            }
        }
    }
#endif
