import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerDetailView: View {
        let player: Player
        @Environment(\.modelContext) private var modelContext
        @Environment(\.dismiss) private var dismiss
        @State private var showingEditSheet = false
        @State private var editingName: String
        @State private var editingColor: Color

        init(player: Player) {
            self.player = player
            _editingName = State(initialValue: player.name ?? "")
            _editingColor = State(
                initialValue: {
                    if let colorData = player.colorData,
                        let uiColor = try? NSKeyedUnarchiver.unarchivedObject(
                            ofClass: UIColor.self, from: colorData)
                    {
                        return Color(uiColor: uiColor)
                    }
                    // Generate a consistent color based on the name
                    let hash = abs(player.name?.hashValue ?? 0)
                    let hue = Double(hash % 255) / 255.0
                    return Color(hue: hue, saturation: 0.7, brightness: 0.9)
                }())
        }

        private var playerColor: Color {
            if let colorData = player.colorData,
                let uiColor = try? NSKeyedUnarchiver.unarchivedObject(
                    ofClass: UIColor.self, from: colorData)
            {
                return Color(uiColor: uiColor)
            }
            // Generate a consistent color based on the name
            let hash = abs(player.name?.hashValue ?? 0)
            let hue = Double(hash % 255) / 255.0
            return Color(hue: hue, saturation: 0.7, brightness: 0.9)
        }

        private func playerImage() -> AnyView {
            if let photoData = player.photoData,
                let uiImage = UIImage(data: photoData)
            {
                return AnyView(
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 120, height: 120)
                        .clipShape(Circle())
                )
            } else {
                return AnyView(
                    PlayerInitialsView(
                        name: player.name ?? "",
                        size: 120,
                        color: playerColor
                    )
                )
            }
        }

        private func matchHistorySection() -> some View {
            Group {
                if let matches = player.matches?.sorted(by: { $0.date > $1.date }) {
                    Section("Match History") {
                        ForEach(matches) { match in
                            NavigationLink {
                                MatchDetailView(match: match)
                            } label: {
                                VStack(alignment: .leading) {
                                    Text(match.game?.title ?? "")
                                        .font(.headline)
                                    Text(match.date, style: .date)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
        }

        var body: some View {
            List {
                Section {
                    HStack {
                        Spacer()
                        playerImage()
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                }

                matchHistorySection()
            }
            .navigationTitle(player.name ?? "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Button("Edit") {
                    showingEditSheet = true
                }
            }
            .sheet(isPresented: $showingEditSheet) {
                NavigationStack {
                    PlayerFormView(
                        name: $editingName,
                        color: $editingColor,
                        existingPhotoData: player.photoData,
                        title: "Edit Player",
                        player: player
                    )
                }
            }
        }
    }
#endif
