import SwiftData
import SwiftUI

struct AddGameView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var isBinaryScore = true
    @State private var showingError = false
    @State private var errorMessage = ""
    @State private var numberOfPlayers = 2

    var body: some View {
        NavigationStack {
            Form {
                TextField("Game Title", text: $title)

                Toggle(
                    "Track Score",
                    isOn: Binding(
                        get: { !isBinaryScore },
                        set: { isBinaryScore = !$0 }
                    )
                )
                .toggleStyle(.switch)

                Section("Number of Players") {
                    Stepper("\(numberOfPlayers) Players", value: $numberOfPlayers, in: 2...99)
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
        }
    }

    private func addGame() {
        let game = Game(
            title: title,
            isBinaryScore: isBinaryScore,
            supportedPlayerCounts: [numberOfPlayers]
        )
        modelContext.insert(game)

        do {
            try modelContext.save()
            print("Successfully added game: \(title)")
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
            print("Failed to save game: \(error)")
        }
    }
}

#Preview {
    AddGameView()
        .modelContainer(for: Game.self, inMemory: true)
}
