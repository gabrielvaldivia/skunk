import SwiftData
import SwiftUI
import UIKit

struct PlayerDetailView: View {
    let player: Player
    @State private var isImagePickerPresented = false
    @State private var selectedImage: UIImage?
    @Environment(\.modelContext) private var modelContext

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
                            PlayerInitialsView(name: player.name, size: 100)
                        }
                    }
                    Spacer()
                }
                .listRowBackground(Color.clear)
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
                        VStack(alignment: .leading) {
                            if let game = match.game {
                                Text(game.title)
                                    .font(.headline)
                            }

                            if let winner = match.winner {
                                Text(winner == player ? "Won" : "Lost")
                                    .foregroundStyle(winner == player ? .green : .red)
                            }

                            Text(match.date, style: .date)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
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
