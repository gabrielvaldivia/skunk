import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerRow: View {
        let player: Player
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @EnvironmentObject private var authManager: AuthenticationManager
        @State private var lastMatchDate: Date?
        @State private var isLoading = false

        private var isCurrentUser: Bool {
            guard let userID = authManager.userID else { return false }
            return player.appleUserID == userID
        }

        private func loadMatches() async {
            guard !isLoading else { return }
            isLoading = true
            defer { isLoading = false }

            // First check cache
            if let matches = cloudKitManager.getPlayerMatches(player.id),
                let lastMatch = matches.sorted(by: { $0.date > $1.date }).first
            {
                lastMatchDate = lastMatch.date
                return
            }

            do {
                // Fetch games if needed
                let games =
                    cloudKitManager.games.isEmpty
                    ? try await cloudKitManager.fetchGames() : cloudKitManager.games

                var allMatches: [Match] = []
                // Fetch matches for each game
                for game in games {
                    if let matches = try? await cloudKitManager.fetchMatches(for: game) {
                        allMatches.append(
                            contentsOf: matches.filter { $0.playerIDs.contains(player.id) })
                    }
                }

                if !allMatches.isEmpty {
                    let sortedMatches = allMatches.sorted { $0.date > $1.date }
                    cloudKitManager.cachePlayerMatches(sortedMatches, for: player.id)
                    lastMatchDate = sortedMatches.first?.date
                }
            } catch {
                print("Error loading matches: \(error)")
            }
        }

        private var subtitle: String {
            if isLoading {
                return "Loading..."
            }
            if let date = lastMatchDate {
                let formatter = RelativeDateTimeFormatter()
                formatter.unitsStyle = .full
                return "Last played " + formatter.localizedString(for: date, relativeTo: Date())
            }
            return "No matches played"
        }

        var body: some View {
            HStack {
                if let photoData = player.photoData,
                    let uiImage = UIImage(data: photoData)
                {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 40, height: 40)
                        .clipShape(Circle())
                } else {
                    PlayerInitialsView(
                        name: player.name,
                        size: 40,
                        color: player.color
                    )
                }

                VStack(alignment: .leading) {
                    HStack {
                        Text(player.name)
                            .font(.body)
                        if isCurrentUser {
                            Text("(You)")
                                .foregroundStyle(.secondary)
                        }
                    }
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .task {
                await loadMatches()
            }
        }
    }
#endif
