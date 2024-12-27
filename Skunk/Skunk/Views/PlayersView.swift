import Foundation
import PhotosUI
import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerFormView: View {
        @Environment(\.modelContext) private var modelContext
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var authManager: AuthenticationManager
        @Binding var name: String
        @State private var selectedItem: PhotosPickerItem?
        @State private var selectedImageData: Data?
        @Binding var color: Color
        @FocusState private var isNameFocused: Bool
        @State private var showingDeleteConfirmation = false
        let existingPhotoData: Data?
        let title: String
        let player: Player?

        private var isCurrentUserProfile: Bool {
            guard let userID = authManager.userID else { return false }
            return player?.appleUserID == userID
        }

        private var canDelete: Bool {
            if let player = player {
                // Can only delete if:
                // 1. It's a managed player (has ownerID but no appleUserID)
                // 2. Current user is the owner
                guard let currentUserID = authManager.userID else { return false }
                return player.ownerID == currentUserID && player.appleUserID == nil
            }
            return false
        }

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
                } footer: {
                    if isCurrentUserProfile {
                        Text(
                            "To remove your profile, you need to delete your account in Settings."
                        )
                        .foregroundStyle(.secondary)
                    }
                }

                if canDelete {
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
                            let newPlayer = Player(
                                name: name,
                                photoData: selectedImageData,
                                ownerID: authManager.userID  // Set the current user as the owner
                            )
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
                    if let player = player, canDelete {
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
        @Query(sort: \Player.name) private var allPlayers: [Player]
        @EnvironmentObject private var authManager: AuthenticationManager
        @State private var showingAddPlayer = false
        @State private var newPlayerName = ""
        @State private var newPlayerColor = Color.blue

        private var currentUser: Player? {
            guard let userID = authManager.userID else { return nil }
            return allPlayers.first { $0.appleUserID == userID }
        }

        private var managedPlayers: [Player] {
            guard let userID = authManager.userID else { return [] }
            return allPlayers.filter { player in
                player.ownerID == userID && player.appleUserID != userID
            }
        }

        private var otherUsers: [Player] {
            guard let userID = authManager.userID else { return [] }
            return allPlayers.filter { player in
                player.appleUserID != nil  // Has an Apple ID (is a real user)
                    && player.appleUserID != userID  // Not the current user
                    && player.ownerID != userID  // Not managed by current user
            }
        }

        var body: some View {
            NavigationStack {
                List {
                    if let currentUser = currentUser {
                        Section("Your Profile") {
                            NavigationLink {
                                PlayerDetailView(player: currentUser)
                            } label: {
                                PlayerRow(player: currentUser)
                            }
                        }
                    }

                    Section("Players You Manage") {
                        if managedPlayers.isEmpty {
                            Text("No managed players")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(managedPlayers) { player in
                                NavigationLink {
                                    PlayerDetailView(player: player)
                                } label: {
                                    PlayerRow(player: player)
                                }
                            }
                        }
                    }

                    Section("Other Players") {
                        if otherUsers.isEmpty {
                            Text("No other players found")
                                .foregroundStyle(.secondary)
                        } else {
                            ForEach(otherUsers) { player in
                                NavigationLink {
                                    PlayerDetailView(player: player)
                                } label: {
                                    PlayerRow(player: player)
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
                .refreshable {
                    // This will trigger a SwiftData refresh
                }
                .onAppear {
                    authManager.setModelContext(modelContext)
                }
            }
        }
    }
#endif
