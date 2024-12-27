import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit
#else
    import AppKit
#endif

struct GamesView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Game.title) private var games: [Game]

    @State private var showingAddGame = false

    var body: some View {
        ZStack {
            if games.isEmpty {
                VStack(spacing: 8) {
                    Text("No Games")
                        .font(.headline)
                        .fontWeight(.semibold)
                    Text("Tap the button above to add a game")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            } else {
                List {
                    ForEach(games) { game in
                        NavigationLink(destination: GameDetailView(game: game)) {
                            Text(game.title ?? "Untitled Game")
                        }
                    }
                    .onDelete(perform: deleteGames)
                }
            }
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
            print("Current games: \(games.map { $0.title ?? "Untitled Game" })")
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
