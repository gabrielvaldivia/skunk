import SwiftData
import SwiftUI

struct TournamentsView: View {
    @Query(sort: \Tournament.date, order: .reverse) private var tournaments: [Tournament]
    @State private var showingGamePicker = false
    @State private var showingNewTournament = false
    @State private var selectedGame: Game?

    var body: some View {
        NavigationStack {
            List {
                ForEach(tournaments) { tournament in
                    NavigationLink {
                        TournamentDetailView(tournament: tournament)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(tournament.name)
                                .font(.headline)
                            if let game = tournament.game {
                                Text(game.title)
                                    .font(.subheadline)
                            }
                            if let winner = tournament.winner {
                                Text("Winner: \(winner.name)")
                                    .font(.caption)
                                    .foregroundStyle(.green)
                            }
                            Text(tournament.date, style: .date)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Tournaments")
            .toolbar {
                Button(action: { showingGamePicker = true }) {
                    Label("New Tournament", systemImage: "plus")
                }
            }
            .sheet(isPresented: $showingGamePicker) {
                GamePickerView { game in
                    selectedGame = game
                    showingGamePicker = false
                    showingNewTournament = true
                }
            }
            .sheet(isPresented: $showingNewTournament) {
                if let game = selectedGame {
                    NewTournamentView(game: game)
                }
            }
        }
    }
}

struct GamePickerView: View {
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Game.title) private var games: [Game]
    let onSelect: (Game) -> Void

    var body: some View {
        NavigationStack {
            List(games) { game in
                Button(action: { onSelect(game) }) {
                    Text(game.title)
                }
            }
            .navigationTitle("Select Game")
            .toolbar {
                Button("Cancel") {
                    dismiss()
                }
            }
        }
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(
        for: Tournament.self, Game.self, Player.self, Match.self, Score.self,
        configurations: config
    )
    let game = Game(title: "Chess", isBinaryScore: true, supportedPlayerCounts: [2])
    let tournament = Tournament(game: game, name: "Chess Championship")
    container.mainContext.insert(game)
    container.mainContext.insert(tournament)

    return TournamentsView()
        .modelContainer(container)
}
