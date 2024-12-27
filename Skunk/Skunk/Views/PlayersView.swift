import Foundation
import PhotosUI
import SwiftData
import SwiftUI

struct PlayerFormView: View {
    @Binding var name: String
    @State private var selectedItem: PhotosPickerItem?
    @State private var selectedImageData: Data?
    @Binding var color: Color
    @FocusState private var isNameFocused: Bool
    let existingPhotoData: Data?
    let title: String

    var body: some View {
        Form {
            Section {
                PhotosPicker(selection: $selectedItem, matching: .images) {
                    if let selectedImageData {
                        Circle()
                            .fill(color)
                            .frame(width: 120, height: 120)
                            .overlay {
                                Image(systemName: "person.fill")
                                    .font(.system(size: 60))
                                    .foregroundStyle(.white)
                            }
                    } else if let existingPhotoData {
                        Circle()
                            .fill(color)
                            .frame(width: 120, height: 120)
                            .overlay {
                                Image(systemName: "person.fill")
                                    .font(.system(size: 60))
                                    .foregroundStyle(.white)
                            }
                    } else if name.isEmpty {
                        Circle()
                            .fill(Color(.tertiarySystemFill))
                            .frame(width: 120, height: 120)
                            .overlay {
                                Image(systemName: "plus")
                                    .font(.system(size: 40))
                                    .foregroundStyle(.primary)
                            }
                    } else {
                        PlayerInitialsView(
                            name: name,
                            size: 120,
                            color: color
                        )
                    }
                }
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
            }
            .onChange(of: selectedItem) { _, newValue in
                Task {
                    if let data = try? await newValue?.loadTransferable(type: Data.self) {
                        selectedImageData = data
                    }
                }
            }

            Section {
                TextField("Name", text: $name)
                    .focused($isNameFocused)
                ColorPicker("Color", selection: $color)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            isNameFocused = true
        }
    }
}

struct PlayersView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Player.name) private var players: [Player]
    @EnvironmentObject private var authManager: AuthenticationManager
    @State private var showingAddPlayer = false
    @State private var showingPlayerDetail: Player?

    private func playersByStatus() -> (online: [Player], offline: [Player]) {
        let onlinePlayers = players.filter { $0.isOnline }
        let offlinePlayers = players.filter { !$0.isOnline }
        return (online: onlinePlayers, offline: offlinePlayers)
    }

    private func timeAgoString(from date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    var body: some View {
        NavigationStack {
            List {
                let status = playersByStatus()
                if !status.online.isEmpty {
                    Section("Online") {
                        ForEach(status.online) { player in
                            PlayerRow(player: player)
                                .badge("Online")
                                .onTapGesture {
                                    showingPlayerDetail = player
                                }
                        }
                    }
                }

                if !status.offline.isEmpty {
                    Section("Offline") {
                        ForEach(status.offline) { player in
                            PlayerRow(player: player)
                                .badge(
                                    player.lastSeen.map {
                                        "Last seen \(timeAgoString(from: $0))"
                                    }
                                )
                                .onTapGesture {
                                    showingPlayerDetail = player
                                }
                        }
                    }
                }
            }
            .navigationTitle("Players")
            .toolbar {
                Button {
                    showingAddPlayer = true
                } label: {
                    Label("Add Player", systemImage: "person.badge.plus")
                }
            }
            .sheet(isPresented: $showingAddPlayer) {
                NavigationStack {
                    PlayerFormView(
                        name: .constant(""),
                        color: .constant(.blue),
                        existingPhotoData: nil,
                        title: "New Player"
                    )
                }
            }
            .sheet(item: $showingPlayerDetail) { player in
                NavigationStack {
                    PlayerDetailView(player: player)
                }
            }
            .refreshable {
                // This will trigger a SwiftData refresh
            }
        }
        .onAppear {
            authManager.setModelContext(modelContext)
        }
    }
}
