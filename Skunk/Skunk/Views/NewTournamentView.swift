import SwiftData
import SwiftUI

struct NewTournamentView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    let game: Game
    @State private var name = ""
    @State private var selectedPlayerIds: Set<String> = []

    @Query private var players: [Player]

    var body: some View {
        NavigationStack {
            Form {
                TextField("Tournament Name", text: $name)

                Section("Players") {
                    ForEach(players) { player in
                        let id = "\(player.persistentModelID)"
                        Toggle(
                            player.name,
                            isOn: Binding(
                                get: { selectedPlayerIds.contains(id) },
                                set: { _ in togglePlayer(player) }
                            )
                        )
                    }
                }
            }
            .navigationTitle("New Tournament")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        saveTournament()
                    }
                    .disabled(name.isEmpty || selectedPlayerIds.count < 2)
                }
            }
        }
    }

    private func togglePlayer(_ player: Player) {
        let id = "\(player.persistentModelID)"
        if selectedPlayerIds.contains(id) {
            selectedPlayerIds.remove(id)
        } else {
            selectedPlayerIds.insert(id)
        }
    }

    private var selectedPlayers: [Player] {
        players.filter { selectedPlayerIds.contains("\($0.persistentModelID)") }
    }

    private func saveTournament() {
        let tournament = Tournament(game: game, name: name)
        tournament.players = selectedPlayers
        modelContext.insert(tournament)
        game.tournaments.append(tournament)

        // Update player relationships
        for player in selectedPlayers {
            player.tournaments.append(tournament)
        }

        dismiss()
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Game.self, configurations: config)
    let game = Game(title: "Chess", isBinaryScore: true, supportedPlayerCounts: [2])
    container.mainContext.insert(game)

    return NavigationStack {
        NewTournamentView(game: game)
    }
    .modelContainer(container)
}
