import SwiftData
import SwiftUI
import UIKit

struct PlayerDetailView: View {
    let player: Player
    @State private var isImagePickerPresented = false
    @State private var selectedImage: UIImage?
    @State private var isEditing = false
    @State private var editedName: String = ""
    @Environment(\.modelContext) private var modelContext
    @Query private var games: [Game]

    private var championedGames: [Game] {
        games.filter { game in
            let playerWins = Dictionary(grouping: game.matches.compactMap { $0.winner }) { $0 }
                .mapValues { $0.count }
            return playerWins.max(by: { $0.value < $1.value })?.key == player
        }
    }

    private var longestStreak: Int {
        let sortedMatches = player.matches.sorted(by: { $0.date < $1.date })
        var currentStreak = 0
        var maxStreak = 0

        for match in sortedMatches {
            if match.winner == player {
                currentStreak += 1
                maxStreak = max(maxStreak, currentStreak)
            } else {
                currentStreak = 0
            }
        }

        return maxStreak
    }

    private var winRate: Double {
        let totalMatches = player.matches.count
        guard totalMatches > 0 else { return 0 }
        let wins = player.matches.filter { $0.winner == player }.count
        return Double(wins) / Double(totalMatches) * 100
    }

    private var mostPlayedGame: (game: Game, count: Int)? {
        let gameMatches = Dictionary(grouping: player.matches) { $0.game }
        return gameMatches.map { ($0.key!, $0.value.count) }
            .max(by: { $0.1 < $1.1 })
    }

    private var mostFrequentOpponent: (player: Player, count: Int)? {
        var opponentCounts: [Player: Int] = [:]
        for match in player.matches {
            for opponent in match.players where opponent != player {
                opponentCounts[opponent, default: 0] += 1
            }
        }
        return opponentCounts.map { ($0.key, $0.value) }
            .max(by: { $0.1 < $1.1 })
    }

    var body: some View {
        List {
            Section {
                VStack(spacing: 12) {
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

                    Text(player.name)
                        .font(.title)
                        .bold()
                }
                .frame(maxWidth: .infinity)
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
                StatsRow(title: "Win Rate", value: String(format: "%.1f%%", winRate))
                StatsRow(title: "Longest Streak", value: longestStreak)

                if let (game, count) = mostPlayedGame {
                    NavigationLink(destination: GameDetailView(game: game)) {
                        StatsRow(title: "Most Played Game", value: "\(game.title) (\(count))")
                    }
                }

                if let (opponent, count) = mostFrequentOpponent {
                    NavigationLink(destination: PlayerDetailView(player: opponent)) {
                        StatsRow(
                            title: "Most Frequent Opponent", value: "\(opponent.name) (\(count))")
                    }
                }
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
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            Button(action: {
                editedName = player.name
                if let imageData = player.photoData {
                    selectedImage = UIImage(data: imageData)
                }
                isEditing = true
            }) {
                Text("Edit")
            }
        }
        .sheet(isPresented: $isEditing) {
            NavigationStack {
                VStack(spacing: 20) {
                    Button(action: { isImagePickerPresented.toggle() }) {
                        if let image = selectedImage {
                            Image(uiImage: image)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 120, height: 120)
                                .clipShape(Circle())
                        } else if let photoData = player.photoData,
                            let uiImage = UIImage(data: photoData)
                        {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 120, height: 120)
                                .clipShape(Circle())
                        } else {
                            PlayerInitialsView(
                                name: editedName.isEmpty ? player.name : editedName,
                                size: 120,
                                colorHue: player.colorHue)
                        }
                    }
                    .padding(.top, 40)

                    TextField("Player Name", text: $editedName)
                        .textFieldStyle(.roundedBorder)
                        .padding(.horizontal)
                        .multilineTextAlignment(.center)

                    Spacer()
                }
                .navigationTitle("Edit Player")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            isEditing = false
                            editedName = player.name
                            if let imageData = player.photoData {
                                selectedImage = UIImage(data: imageData)
                            } else {
                                selectedImage = nil
                            }
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            if !editedName.isEmpty {
                                player.name = editedName
                                if let image = selectedImage {
                                    player.photoData = image.jpegData(compressionQuality: 0.8)
                                }
                                try? modelContext.save()
                            }
                            isEditing = false
                        }
                        .disabled(editedName.isEmpty)
                    }
                }
            }
            .sheet(isPresented: $isImagePickerPresented) {
                ImagePicker(image: $selectedImage)
            }
        }
    }
}

struct StatsRow: View {
    let title: String
    let value: CustomStringConvertible

    init(title: String, value: CustomStringConvertible) {
        self.title = title
        self.value = value
    }

    var body: some View {
        HStack {
            Text(title)
            Spacer()
            Text("\(value.description)")
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
