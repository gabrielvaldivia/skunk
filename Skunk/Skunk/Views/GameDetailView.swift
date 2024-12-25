import SwiftData
import SwiftUI
import UIKit

struct GameDetailView: View {
    let game: Game
    @State private var showingNewMatch = false
    @State private var showingNewTournament = false
    @Environment(\.modelContext) private var modelContext

    private var champion: Player? {
        let matches = game.matches
        let winners = matches.compactMap { $0.winner }
        let winCounts = Dictionary(grouping: winners) { $0 }
            .mapValues { $0.count }
        return winCounts.max(by: { $0.value < $1.value })?.key
    }

    var body: some View {
        List {
            if let champion = champion {
                Section("Current Champion") {
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
                                name: champion.name, size: 40, colorHue: champion.colorHue)
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
                        NavigationLink(destination: MatchDetailView(match: match)) {
                            MatchRow(match: match, showGameTitle: false)
                        }
                    }
                    .onDelete { indexSet in
                        let sortedMatches = game.matches.sorted(by: { $0.date > $1.date })
                        indexSet.forEach { index in
                            if index < sortedMatches.count {
                                let match = sortedMatches[index]
                                // Remove match from players
                                match.players.forEach { player in
                                    player.matches.removeAll { $0.id == match.id }
                                }
                                // Remove match from game
                                game.matches.removeAll { $0.id == match.id }
                                // Delete scores
                                match.scores.forEach { score in
                                    modelContext.delete(score)
                                }
                                // Delete the match
                                modelContext.delete(match)
                            }
                        }
                        try? modelContext.save()
                    }
                }
            }

            Section("Tournaments") {
                let sortedTournaments = game.tournaments.sorted(by: { $0.date > $1.date })
                if sortedTournaments.isEmpty {
                    Text("No tournaments yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(sortedTournaments) { tournament in
                        TournamentRow(tournament: tournament)
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
        .sheet(isPresented: $showingNewTournament) {
            NewTournamentView(game: game)
        }
    }
}

struct TournamentRow: View {
    let tournament: Tournament

    var body: some View {
        VStack(alignment: .leading) {
            Text(tournament.name)
                .font(.headline)
            if let winner = tournament.winner {
                Text("Winner: \(winner.name)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(tournament.date, style: .date)
                .font(.caption)
                .foregroundStyle(.secondary)
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
