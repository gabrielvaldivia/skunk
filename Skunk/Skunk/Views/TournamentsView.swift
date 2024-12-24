import SwiftData
import SwiftUI

struct TournamentsView: View {
    @Query private var tournaments: [Tournament]

    var body: some View {
        NavigationStack {
            List {
                ForEach(tournaments) { tournament in
                    NavigationLink(destination: TournamentDetailView(tournament: tournament)) {
                        VStack(alignment: .leading) {
                            Text(tournament.name)
                                .font(.headline)

                            if let game = tournament.game {
                                Text(game.title)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }

                            if let winner = tournament.winner {
                                Text("Winner: \(winner.name)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Text(tournament.date, style: .date)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Tournaments")
        }
    }
}

#Preview {
    TournamentsView()
        .modelContainer(
            for: [
                Tournament.self,
                Game.self,
                Player.self,
                Match.self,
                Score.self,
            ], inMemory: true)
}
