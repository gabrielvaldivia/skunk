import Foundation
import PhotosUI
import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerFormView: View {
        @Environment(\.modelContext) private var modelContext
        @Environment(\.dismiss) private var dismiss
        @Binding var name: String
        @State private var selectedItem: PhotosPickerItem?
        @State private var selectedImageData: Data?
        @Binding var color: Color
        @FocusState private var isNameFocused: Bool
        @State private var showingDeleteConfirmation = false
        let existingPhotoData: Data?
        let title: String
        let player: Player?

        var body: some View {
            Form {
                Section {
                    PhotosPicker(selection: $selectedItem, matching: .images) {
                        if let selectedImageData,
                            let uiImage = UIImage(data: selectedImageData)
                        {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 120, height: 120)
                                .clipShape(Circle())
                        } else if let existingPhotoData,
                            let uiImage = UIImage(data: existingPhotoData)
                        {
                            Image(uiImage: uiImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 120, height: 120)
                                .clipShape(Circle())
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

                if player != nil {
                    Section {
                        Button(role: .destructive) {
                            showingDeleteConfirmation = true
                        } label: {
                            Label("Delete Player", systemImage: "trash")
                        }
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(player == nil ? "Add" : "Save") {
                        if let player = player {
                            // Update existing player
                            player.name = name
                            player.photoData = selectedImageData ?? existingPhotoData
                            if let color = try? NSKeyedArchiver.archivedData(
                                withRootObject: UIColor(color), requiringSecureCoding: true)
                            {
                                player.colorData = color
                            }
                        } else {
                            // Create new player
                            let newPlayer = Player(name: name)
                            newPlayer.photoData = selectedImageData
                            if let color = try? NSKeyedArchiver.archivedData(
                                withRootObject: UIColor(color), requiringSecureCoding: true)
                            {
                                newPlayer.colorData = color
                            }
                            modelContext.insert(newPlayer)
                        }
                        try? modelContext.save()
                        dismiss()
                    }
                    .disabled(name.isEmpty)
                }
            }
            .alert("Delete Player", isPresented: $showingDeleteConfirmation) {
                Button("Delete", role: .destructive) {
                    if let player = player {
                        modelContext.delete(player)
                        try? modelContext.save()
                    }
                    dismiss()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to delete this player? This action cannot be undone.")
            }
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
        @State private var newPlayerName = ""
        @State private var newPlayerColor = Color.blue

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
                                Button {
                                    showingPlayerDetail = player
                                } label: {
                                    PlayerRow(player: player)
                                        .badge("Online")
                                }
                            }
                        }
                    }

                    if !status.offline.isEmpty {
                        Section("Offline") {
                            ForEach(status.offline) { player in
                                Button {
                                    showingPlayerDetail = player
                                } label: {
                                    PlayerRow(player: player)
                                        .badge(
                                            player.lastSeen.map {
                                                "Last seen \(timeAgoString(from: $0))"
                                            }
                                        )
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
                            name: $newPlayerName,
                            color: $newPlayerColor,
                            existingPhotoData: nil,
                            title: "New Player",
                            player: nil
                        )
                    }
                }
                .onChange(of: showingAddPlayer) { _, isShowing in
                    if !isShowing {
                        // Reset the form when sheet is dismissed
                        newPlayerName = ""
                        newPlayerColor = .blue
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
#endif
