import SwiftData
import SwiftUI

struct PlayerDetailView: View {
    let player: Player
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var showingEditSheet = false
    @State private var showingDeleteConfirmation = false

    private var playerColor: Color {
        // Generate a consistent color based on the name
        let name = player.name ?? ""
        let hash = abs(name.hashValue)
        let hue = Double(hash % 255) / 255.0
        return Color(hue: hue, saturation: 0.7, brightness: 0.9)
    }

    private func playerImage() -> AnyView {
        if player.photoData != nil {
            return AnyView(
                Circle()
                    .fill(playerColor)
                    .frame(width: 120, height: 120)
                    .overlay {
                        Image(systemName: "person.fill")
                            .font(.system(size: 60))
                            .foregroundStyle(.white)
                    }
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

            Section {
                Button(role: .destructive) {
                    showingDeleteConfirmation = true
                } label: {
                    Label("Delete Player", systemImage: "trash")
                }
            }
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
                    name: .constant(player.name ?? ""),
                    color: .constant(playerColor),
                    existingPhotoData: player.photoData,
                    title: "Edit Player"
                )
            }
        }
        .alert("Delete Player", isPresented: $showingDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                modelContext.delete(player)
                try? modelContext.save()
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to delete this player? This action cannot be undone.")
        }
    }
}
