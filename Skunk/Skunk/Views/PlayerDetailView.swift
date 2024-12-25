import SwiftData
import SwiftUI
import UIKit

struct PlayerDetailView: View {
    let player: Player
    @State private var isImagePickerPresented = false
    @State private var selectedImage: UIImage?
    @Environment(\.modelContext) private var modelContext
    @Query private var games: [Game]

    private var championedGames: [Game] {
        games.filter { game in
            let playerWins = Dictionary(grouping: game.matches.compactMap { $0.winner }) { $0 }
                .mapValues { $0.count }
            return playerWins.max(by: { $0.value < $1.value })?.key == player
        }
    }

    var body: some View {
        List {
            Section {
                HStack {
                    Spacer()
                    Button(action: { isImagePickerPresented.toggle() }) {
                        if let photoData = player.photoData,
                            let uiImage = UIImage(data: photoData)
                        {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 100, height: 100)
                                .clipShape(Circle())
                        } else {
                            PlayerInitialsView(
                                name: player.name, size: 100, colorHue: player.colorHue)
                        }
                    }
                    Spacer()
                }
                .listRowBackground(Color.clear)
            }

            if !championedGames.isEmpty {
                Section("Current Champion Of") {
                    ForEach(championedGames) { game in
                        NavigationLink(destination: GameDetailView(game: game)) {
                            HStack {
                                Text(game.title)
                                Spacer()
                                Text("\(game.matches.filter { $0.winner == player }.count) wins")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            Section("Stats") {
                StatsRow(title: "Matches Played", value: player.matches.count)
                StatsRow(
                    title: "Matches Won",
                    value: player.matches.filter { $0.winner == player }.count)
                StatsRow(
                    title: "Tournaments Won",
                    value: player.tournaments.filter { $0.winner == player }.count)
            }

            Section("Recent Matches") {
                let sortedMatches = player.matches.sorted(by: { $0.date > $1.date })
                if sortedMatches.isEmpty {
                    Text("No matches played yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(sortedMatches.prefix(5)) { match in
                        MatchRow(match: match)
                    }
                }
            }

            Section("Tournaments") {
                let sortedTournaments = player.tournaments.sorted(by: { $0.date > $1.date })
                if sortedTournaments.isEmpty {
                    Text("No tournaments played yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(sortedTournaments) { tournament in
                        VStack(alignment: .leading) {
                            Text(tournament.name)
                                .font(.headline)
                            if let game = tournament.game {
                                Text(game.title)
                                    .font(.subheadline)
                            }
                            if tournament.winner == player {
                                Text("Winner")
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
        }
        .navigationTitle(player.name)
        .sheet(isPresented: $isImagePickerPresented) {
            ImagePicker(image: $selectedImage)
                .onChange(of: selectedImage) { _, newImage in
                    if let image = newImage {
                        updatePlayerPhoto(image)
                    }
                }
        }
    }

    private func updatePlayerPhoto(_ image: UIImage) {
        player.photoData = image.jpegData(compressionQuality: 0.8)
        try? modelContext.save()
    }
}

struct StatsRow: View {
    let title: String
    let value: Int

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            Text("\(value)")
                .bold()
        }
    }
}

#Preview {
    do {
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: Player.self, configurations: config)
        let player = Player(name: "Alice")
        return NavigationStack {
            PlayerDetailView(player: player)
        }
        .modelContainer(container)
    } catch {
        return Text("Failed to create preview: \(error.localizedDescription)")
    }
}
