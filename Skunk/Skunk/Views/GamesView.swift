import SwiftData
import SwiftUI

struct GamesView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Game.title) private var games: [Game]

    @State private var showingAddGame = false

    var body: some View {
        List {
            ForEach(games) { game in
                NavigationLink(destination: GameDetailView(game: game)) {
                    Text(game.title)
                }
            }
            .onDelete(perform: deleteGames)
        }
        .navigationTitle("Games")
        .toolbar {
            Button(action: { showingAddGame.toggle() }) {
                Label("Add Game", systemImage: "plus")
            }
        }
        .sheet(isPresented: $showingAddGame) {
            AddGameView()
        }
        .onAppear {
            print("Current games: \(games.map { $0.title })")
        }
    }

    private func deleteGames(offsets: IndexSet) {
        withAnimation {
            for index in offsets {
                modelContext.delete(games[index])
            }
            do {
                try modelContext.save()
                print("Successfully deleted games")
            } catch {
                print("Failed to save after deletion: \(error)")
            }
        }
    }
}

#Preview {
    GamesView()
        .modelContainer(for: Game.self, inMemory: true)
}
