import Charts
import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit
    typealias PlatformColor = UIColor
    typealias PlatformImage = UIImage
    typealias PlatformImagePickerController = UIImagePickerController
#else
    import AppKit
    typealias PlatformColor = NSColor
    typealias PlatformImage = NSImage
#endif

extension PlatformColor {
    var hue: Double {
        var h: CGFloat = 0
        getHue(&h, saturation: nil, brightness: nil, alpha: nil)
        return Double(h)
    }
}

#if canImport(UIKit)
    extension UIColor {
        convenience init(_ color: Color) {
            self.init(color)
        }
    }
#else
    extension NSColor {
        convenience init(_ color: Color) {
            self.init(color)
        }
    }
#endif

struct PlayerDetailView: View {
    let player: Player
    @State private var isImagePickerPresented = false
    @State private var selectedImage: PlatformImage?
    @State private var isEditing = false
    @State private var editedName: String = ""
    @Environment(\.modelContext) private var modelContext
    @Query private var games: [Game]

    private var championedGames: [Game] {
        games.filter { game in
            guard let matches = game.matches, !matches.isEmpty else { return false }
            let playerWins = Dictionary(grouping: matches.compactMap { $0.winner }) { $0 }
                .mapValues { $0.count }
            guard !playerWins.isEmpty else { return false }
            return playerWins.max(by: { $0.value < $1.value })?.key == player
        }
    }

    private var longestStreak: Int {
        guard let matches = player.matches else { return 0 }
        let sortedMatches = matches.sorted(by: { $0.date < $1.date })
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
        guard let matches = player.matches else { return 0 }
        let totalMatches = matches.count
        guard totalMatches > 0 else { return 0 }
        let wins = matches.filter { $0.winner == player }.count
        let rate = Double(wins) / Double(totalMatches) * 100
        return rate.isFinite ? rate : 0
    }

    var body: some View {
        List {
            Section {
                VStack(spacing: 12) {
                    if let photoData = player.photoData {
                        #if canImport(UIKit)
                            if let uiImage = UIImage(data: photoData) {
                                Image(uiImage: uiImage)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 100, height: 100)
                                    .clipShape(Circle())
                            }
                        #else
                            if let nsImage = NSImage(data: photoData) {
                                Image(nsImage: nsImage)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 100, height: 100)
                                    .clipShape(Circle())
                            }
                        #endif
                    } else {
                        PlayerInitialsView(
                            name: player.name ?? "",
                            size: 100,
                            colorData: player.colorData)
                    }

                    Text(player.name ?? "Unknown Player")
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
                                Text(game.title ?? "")
                                Spacer()
                                if let matches = game.matches {
                                    Text("\(matches.filter { $0.winner == player }.count) wins")
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }

            Section("Stats") {
                let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 2)
                LazyVGrid(columns: columns, spacing: 12) {
                    StatCard(title: "Matches Played", value: player.matches?.count ?? 0)
                    StatCard(
                        title: "Matches Won",
                        value: player.matches?.filter { $0.winner == player }.count ?? 0
                    )
                    StatCard(title: "Win Rate", value: "\(max(0, min(100, Int(winRate))))%")
                    StatCard(title: "Longest Streak", value: longestStreak)
                }
                .padding(.vertical, 8)
            }

            if let matches = player.matches, !matches.isEmpty {
                Section("Match History") {
                    let sortedMatches = matches.sorted(by: { $0.date > $1.date })
                    ForEach(sortedMatches) { match in
                        MatchRow(match: match)
                    }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            Button(action: {
                editedName = player.name ?? ""
                if let imageData = player.photoData {
                    #if canImport(UIKit)
                        selectedImage = UIImage(data: imageData)
                    #else
                        selectedImage = NSImage(data: imageData)
                    #endif
                }
                isEditing = true
            }) {
                Text("Edit")
            }
        }
        .sheet(isPresented: $isEditing) {
            NavigationStack {
                PlayerFormView(
                    name: $editedName,
                    selectedImage: $selectedImage,
                    color: Binding(
                        get: {
                            if let colorData = player.colorData,
                                let color = try? NSKeyedUnarchiver.unarchivedObject(
                                    ofClass: PlatformColor.self, from: colorData)
                            {
                                Color(uiColor: color)
                            } else {
                                .blue
                            }
                        },
                        set: { newColor in
                            if let colorData = try? NSKeyedArchiver.archivedData(
                                withRootObject: PlatformColor(newColor), requiringSecureCoding: true
                            ) {
                                player.colorData = colorData
                            }
                        }
                    ),
                    existingPhotoData: player.photoData,
                    existingColorData: player.colorData,
                    title: "Edit Player"
                )
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            isEditing = false
                            editedName = player.name ?? ""
                            if let imageData = player.photoData {
                                #if canImport(UIKit)
                                    selectedImage = UIImage(data: imageData)
                                #else
                                    selectedImage = NSImage(data: imageData)
                                #endif
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
                                    #if canImport(UIKit)
                                        player.photoData = image.jpegData(compressionQuality: 0.8)
                                    #else
                                        player.photoData = image.tiffRepresentation
                                    #endif
                                }
                                try? modelContext.save()
                            }
                            isEditing = false
                        }
                        .disabled(editedName.isEmpty)
                    }
                }
            }
        }
    }
}

struct StatCard: View {
    let title: String
    let value: CustomStringConvertible
    let destination: (() -> any View)?

    init(title: String, value: CustomStringConvertible, destination: (() -> any View)? = nil) {
        self.title = title
        self.value = value
        self.destination = destination
    }

    var body: some View {
        Group {
            if let destination = destination {
                NavigationLink(destination: AnyView(destination())) {
                    cardContent
                }
            } else {
                cardContent
            }
        }
    }

    private var cardContent: some View {
        VStack(alignment: .center, spacing: 4) {
            Text(value.description)
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(.primary)
                .minimumScaleFactor(0.5)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 100)
        .padding(.vertical, 12)
        #if canImport(UIKit)
            .background(Color(uiColor: .systemGray6))
        #else
            .background(Color(nsColor: .windowBackgroundColor))
        #endif
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
