import SwiftData
import SwiftUI
import UIKit

struct GameDetailView: View {
    let game: Game
    @State private var showingNewMatch = false
    @State private var showingNewTournament = false

    private var champion: Player? {
        let playerWins = Dictionary(grouping: game.matches.compactMap { $0.winner }) { $0 }
            .mapValues { $0.count }
        return playerWins.max(by: { $0.value < $1.value })?.key
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
                            PlayerInitialsView(name: champion.name, size: 40)
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
                            Text("\(game.matches.filter { $0.winner == champion }.count) wins")
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
                        MatchRow(match: match)
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
            Menu {
                Button(action: { showingNewMatch.toggle() }) {
                    Label("New Match", systemImage: "flag")
                }
                Button(action: { showingNewTournament.toggle() }) {
                    Label("New Tournament", systemImage: "trophy")
                }
            } label: {
                Image(systemName: "plus")
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

struct MatchRow: View {
    let match: Match

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                if let winner = match.winner {
                    NavigationLink(destination: PlayerDetailView(player: winner)) {
                        Text(winner.name)
                            .font(.headline)
                    }
                    Text("won")
                        .foregroundStyle(.secondary)
                }
            }

            let players = match.players
            HStack {
                ForEach(players.indices, id: \.self) { index in
                    if index > 0 {
                        Text("vs")
                            .foregroundStyle(.secondary)
                    }
                    NavigationLink(destination: PlayerDetailView(player: players[index])) {
                        Text(players[index].name)
                    }
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)

            Text(match.date, style: .date)
                .font(.caption)
                .foregroundStyle(.secondary)
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
