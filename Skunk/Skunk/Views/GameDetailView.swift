import SwiftData
import SwiftUI
import UIKit

struct GameDetailView: View {
    let game: Game
    @State private var showingNewMatch = false
    @Environment(\.modelContext) private var modelContext

    private var championshipStatus: (winner: Player?, isDraw: Bool) {
        let matches = game.matches
        let winners = matches.compactMap { $0.winner }
        let winCounts = Dictionary(grouping: winners) { $0 }
            .mapValues { $0.count }

        if let maxCount = winCounts.values.max() {
            let topPlayers = winCounts.filter { $0.value == maxCount }
            if topPlayers.count > 1 {
                return (nil, true)  // Draw
            } else {
                return (topPlayers.first?.key, false)  // Clear winner
            }
        }
        return (nil, false)  // No games played
    }

    var body: some View {
        List {
            Section("Champion") {
                if championshipStatus.isDraw {
                    Text("Draw")
                        .font(.headline)
                        .foregroundStyle(.orange)
                } else if let champion = championshipStatus.winner {
                    HStack {
                        if let photoData = champion.photoData,
                            let uiImage = UIImage(data: photoData)
                        {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 40, height: 40)
                                .clipShape(Circle())
                        } else {
                            PlayerInitialsView(
                                name: champion.name,
                                size: 40,
                                colorHue: champion.colorHue)
                        }

                        VStack(alignment: .leading) {
                            Text(champion.name)
                                .font(.headline)
                                .foregroundStyle(.blue)
                                .onTapGesture {
                                    // Create a navigation link programmatically
                                    let detailView = PlayerDetailView(player: champion)
                                    let hostingController = UIHostingController(
                                        rootView: detailView)
                                    if let windowScene = UIApplication.shared.connectedScenes.first
                                        as? UIWindowScene,
                                        let window = windowScene.windows.first,
                                        let rootViewController = window.rootViewController
                                    {
                                        rootViewController.present(
                                            hostingController, animated: true)
                                    }
                                }
                            let winCount = game.matches.filter { $0.winner == champion }.count
                            Text("\(winCount) wins")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Section("Recent Matches") {
                let sortedMatches = game.matches.sorted(by: { $0.date > $1.date })
                if sortedMatches.isEmpty {
                    Text("No matches yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(sortedMatches.prefix(5)) { match in
                        MatchRow(match: match, showGameTitle: false)
                    }
                }
            }
        }
        .navigationTitle(game.title)
        .toolbar {
            Button(action: { showingNewMatch.toggle() }) {
                Label("New Match", systemImage: "plus")
            }
        }
        .sheet(isPresented: $showingNewMatch) {
            NewMatchView(game: game)
        }
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Game.self, configurations: config)
    let game = Game(title: "Chess", isBinaryScore: true, supportedPlayerCounts: [2])
    container.mainContext.insert(game)

    return NavigationStack {
        GameDetailView(game: game)
    }
    .modelContainer(container)
}
