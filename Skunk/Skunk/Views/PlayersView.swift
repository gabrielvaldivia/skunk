import Foundation
import PhotosUI
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerFormView: View {
        @Environment(\.dismiss) private var dismiss
        @EnvironmentObject private var authManager: AuthenticationManager
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @Binding var name: String
        @State private var selectedItem: PhotosPickerItem?
        @State private var selectedImageData: Data?
        @Binding var color: Color
        @FocusState private var isNameFocused: Bool
        @State private var showingDeleteConfirmation = false
        @State private var isSaving = false
        @State private var error: Error?
        @State private var showingError = false
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
                    HStack {
                        TextField("Name", text: $name)
                            .focused($isNameFocused)
                        ColorPicker("", selection: $color)
                    }
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
                    .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(player == nil ? "Add" : "Save") {
                        Task {
                            do {
                                isSaving = true
                                try await savePlayer()
                                dismiss()
                            } catch {
                                print(
                                    "🟣 PlayerFormView: Error saving player: \(error.localizedDescription)"
                                )
                                self.error = error
                                showingError = true
                            }
                            isSaving = false
                        }
                    }
                    .disabled(name.isEmpty || isSaving)
                }
                if isSaving {
                    ToolbarItem(placement: .principal) {
                        ProgressView()
                    }
                }
            }
            .alert("Delete Player", isPresented: $showingDeleteConfirmation) {
                Button("Delete", role: .destructive) {
                    Task {
                        if let player = player, canDelete {
                            try? await cloudKitManager.deletePlayer(player)
                            try? await cloudKitManager.refreshPlayers()
                        }
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to delete this player? This action cannot be undone.")
            }
            .alert("Error Saving Player", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
            .onAppear {
                isNameFocused = true
            }
            .onDisappear {
                // Refresh players when the form is dismissed
                Task {
                    try? await cloudKitManager.refreshPlayers()
                }
            }
        }

        private func savePlayer() async throws {
            if let player = player {
                // Update existing player
                let updatedPlayer = player.updated(
                    name: name,
                    photoData: selectedImageData ?? existingPhotoData
                )
                print(
                    "🟣 PlayerFormView: Updating player with photo data: \(updatedPlayer.photoData?.count ?? 0) bytes"
                )
                try await cloudKitManager.updatePlayer(updatedPlayer)
                print("🟣 PlayerFormView: Successfully updated player")
            } else {
                // Create new player
                let newPlayer = Player(
                    name: name,
                    photoData: selectedImageData,
                    appleUserID: isCurrentUserProfile ? authManager.userID : nil,
                    ownerID: authManager.userID
                )
                print(
                    "🟣 PlayerFormView: Creating new player with photo data: \(newPlayer.photoData?.count ?? 0) bytes"
                )
                try await cloudKitManager.savePlayer(newPlayer)
                print("🟣 PlayerFormView: Successfully created new player")
            }
        }
    }

    private enum ViewMode {
        case players
        case groups
    }

    struct PlayersView: View {
        @EnvironmentObject private var authManager: AuthenticationManager
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var showingAddPlayer = false
        @State private var newPlayerName = ""
        @State private var newPlayerColor = Color.blue
        @State private var isLoading = false
        @State private var error: Error?
        @State private var showingError = false
        @State private var viewMode: ViewMode = .players

        private var currentUser: Player? {
            guard let userID = authManager.userID else { return nil }
            return cloudKitManager.players.first { $0.appleUserID == userID }
        }

        private var managedPlayers: [Player] {
            guard let userID = authManager.userID else { return [] }
            return cloudKitManager.players.filter { player in
                player.ownerID == userID && player.appleUserID != userID
            }
        }

        private var otherUsers: [Player] {
            guard let userID = authManager.userID else { return [] }
            return cloudKitManager.players.filter { player in
                player.appleUserID != nil  // Has an Apple ID (is a real user)
                    && player.appleUserID != userID  // Not the current user
                    && player.ownerID != userID  // Not managed by current user
            }
        }

        var body: some View {
            VStack(spacing: 0) {
                // Fixed header with segmented control
                Picker("View", selection: $viewMode) {
                    Text("All").tag(ViewMode.players)
                    Text("Groups").tag(ViewMode.groups)
                }
                .pickerStyle(.segmented)
                .padding()

                // Content area that takes remaining space
                GeometryReader { geometry in
                    ZStack(alignment: .center) {
                        if isLoading {
                            ProgressView()
                        } else {
                            if viewMode == .players {
                                playersView
                            } else {
                                PlayerGroupsView()
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle("Players")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await loadPlayers()
            }
            .refreshable {
                await loadPlayers()
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
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
        }

        private var playersView: some View {
            ScrollView {
                // All Players container
                VStack(alignment: .leading, spacing: 20) {
                    // Your Players section
                    VStack(alignment: .leading, spacing: 0) {

                        // Your Players container
                        VStack(alignment: .leading, spacing: 0) {
                            // Your Player
                            if let currentUser = currentUser {
                                NavigationLink {
                                    PlayerDetailView(player: currentUser)
                                } label: {
                                    PlayerRow(player: currentUser)
                                        .padding(.vertical, 8)
                                }
                            }

                            // Managed Players
                            ForEach(managedPlayers) { player in
                                NavigationLink {
                                    PlayerDetailView(player: player)
                                } label: {
                                    PlayerRow(player: player)
                                        .padding(.vertical, 8)
                                }
                            }

                            // Add Player button
                            Button {
                                showingAddPlayer = true
                            } label: {
                                HStack {
                                    Text("Add Player")
                                        .foregroundStyle(.blue)
                                    Spacer()
                                }
                                .padding(.vertical, 8)
                            }
                        }
                    }

                    // Online Players section
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Online Players")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        VStack(alignment: .leading, spacing: 0) {
                            if otherUsers.isEmpty {
                                HStack {
                                    Text("No other players found")
                                        .foregroundStyle(.secondary)
                                    Spacer()
                                }
                                .padding(.vertical, 8)
                            } else {
                                ForEach(otherUsers) { player in
                                    NavigationLink {
                                        PlayerDetailView(player: player)
                                    } label: {
                                        PlayerRow(player: player)
                                            .padding(.vertical, 12)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical)
            }
        }

        private func loadPlayers() async {
            print("🔵 PlayersView: Starting to load players")
            isLoading = true
            do {
                print("🔵 PlayersView: Calling fetchPlayers")
                // Only force refresh if we don't have any players
                _ = try await cloudKitManager.fetchPlayers(
                    forceRefresh: cloudKitManager.players.isEmpty)
                print("🔵 PlayersView: Successfully loaded players")
            } catch {
                print("🔵 PlayersView: Error loading players: \(error.localizedDescription)")
                self.error = error
                showingError = true
            }
            isLoading = false
        }
    }
#endif
