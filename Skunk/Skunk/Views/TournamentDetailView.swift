import SwiftData
import SwiftUI
import UIKit

struct TournamentDetailView: View {
    let tournament: Tournament
    @State private var showingNewMatch = false

    var body: some View {
        List {
            Section {
                if let game = tournament.game {
                    LabeledContent("Game", value: game.title)
                }
                LabeledContent("Date", value: tournament.date, format: .dateTime)
                if let winner = tournament.winner {
                    LabeledContent("Winner", value: winner.name)
                }
            }

            Section("Players") {
                if tournament.players.isEmpty {
                    Text("No players yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(tournament.players) { player in
                        HStack {
                            if let photoData = player.photoData,
                                let uiImage = UIImage(data: photoData)
                            {
                                Image(uiImage: uiImage)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 30, height: 30)
                                    .clipShape(Circle())
                            } else {
                                PlayerInitialsView(
                                    name: player.name, size: 30, colorHue: player.colorHue)
                            }
                            Text(player.name)
                                .padding(.leading, 8)
                        }
                    }
                }
            }

            Section("Matches") {
                let sortedMatches = tournament.matches.sorted(by: { $0.date > $1.date })
                if sortedMatches.isEmpty {
                    Text("No matches played yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(sortedMatches) { match in
                        VStack(alignment: .leading) {
                            if let winner = match.winner {
                                NavigationLink(destination: PlayerDetailView(player: winner)) {
                                    Text("Winner: \(winner.name)")
                                        .font(.headline)
                                }
                            }

                            let players = match.players
                            HStack {
                                ForEach(players.indices, id: \.self) { index in
                                    if index > 0 {
                                        Text("vs")
                                            .foregroundStyle(.secondary)
                                    }
                                    NavigationLink(
                                        destination: PlayerDetailView(player: players[index])
                                    ) {
                                        Text(players[index].name)
                                    }
                                }
                            }
                            .font(.subheadline)

                            Text(match.date, style: .date)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(tournament.name)
        .toolbar {
            if tournament.winner == nil {
                Button(action: { showingNewMatch.toggle() }) {
                    Label("New Match", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showingNewMatch) {
            if let game = tournament.game {
                NewMatchView(game: game)
            }
        }
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Tournament.self, Game.self, configurations: config)
    let game = Game(title: "Chess", isBinaryScore: true, supportedPlayerCounts: [2])
    let tournament = Tournament(game: game, name: "Chess Championship")
    container.mainContext.insert(game)
    container.mainContext.insert(tournament)

    return NavigationStack {
        TournamentDetailView(tournament: tournament)
    }
    .modelContainer(container)
}
