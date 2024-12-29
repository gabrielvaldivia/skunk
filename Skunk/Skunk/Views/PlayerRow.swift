import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct PlayerRow: View {
        let player: Player?
        let group: PlayerGroup?
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @EnvironmentObject private var authManager: AuthenticationManager
        @State private var matches: [Match] = []
        @State private var isLoading = false

        private var isCurrentUser: Bool {
            guard let userID = authManager.userID, let player = player else { return false }
            return player.appleUserID == userID
        }

        private var players: [Player] {
            if let group = group {
                return group.playerIDs.compactMap { id in
                    cloudKitManager.getPlayer(id: id)
                }
            } else if let player = player {
                return [player]
            }
            return []
        }

        private var displayName: String {
            if let group = group {
                let names = group.playerIDs.compactMap { id in
                    cloudKitManager.getPlayer(id: id)?.name
                }

                switch names.count {
                case 0:
                    return "No players"
                case 1:
                    return names[0]
                case 2:
                    return "\(names[0]) & \(names[1])"
                default:
                    let allButLast = names.dropLast().joined(separator: ", ")
                    return "\(allButLast), & \(names.last!)"
                }
            } else if let player = player {
                return player.name
            }
            return ""
        }

        private func loadMatches() async {
            guard !isLoading else { return }
            isLoading = true
            defer { isLoading = false }

            do {
                // Fetch games if needed
                let games = try await cloudKitManager.fetchGames()

                var allMatches: [Match] = []
                // Fetch matches for each game
                for game in games {
                    if let gameMatches = try? await cloudKitManager.fetchMatches(for: game) {
                        if let group = group {
                            allMatches.append(
                                contentsOf: gameMatches.filter { match in
                                    Set(match.playerIDs) == Set(group.playerIDs)
                                }
                            )
                        } else if let player = player {
                            allMatches.append(
                                contentsOf: gameMatches.filter { $0.playerIDs.contains(player.id) }
                            )
                        }
                    }
                }

                if !allMatches.isEmpty {
                    let sortedMatches = allMatches.sorted { $0.date > $1.date }
                    if let group = group {
                        cloudKitManager.cacheGroupMatches(sortedMatches, for: group.id)
                    } else if let player = player {
                        cloudKitManager.cachePlayerMatches(sortedMatches, for: player.id)
                    }
                    await MainActor.run {
                        matches = sortedMatches
                    }
                }
            } catch {
                print("Error loading matches: \(error)")
            }
        }

        private var subtitle: String {
            if isLoading {
                return "Loading..."
            }

            // First check the cache
            if let group = group,
                let cachedMatches = cloudKitManager.getGroupMatches(group.id),
                let lastMatch = cachedMatches.first,
                let game = lastMatch.game
            {
                let formatter = RelativeDateTimeFormatter()
                formatter.unitsStyle = .full
                let timeAgo = formatter.localizedString(for: lastMatch.date, relativeTo: Date())
                return "Last played \(game.title) \(timeAgo)"
            } else if let player = player,
                let cachedMatches = cloudKitManager.getPlayerMatches(player.id),
                let lastMatch = cachedMatches.first,
                let game = lastMatch.game
            {
                let formatter = RelativeDateTimeFormatter()
                formatter.unitsStyle = .full
                let timeAgo = formatter.localizedString(for: lastMatch.date, relativeTo: Date())
                return "Last played \(game.title) \(timeAgo)"
            }

            // If not in cache, use the loaded matches
            if let lastMatch = matches.first,
                let game = lastMatch.game
            {
                let formatter = RelativeDateTimeFormatter()
                formatter.unitsStyle = .full
                let timeAgo = formatter.localizedString(for: lastMatch.date, relativeTo: Date())
                return "Last played \(game.title) \(timeAgo)"
            }

            return "No matches yet"
        }

        var body: some View {
            HStack {
                VStack(alignment: .leading) {
                    HStack {
                        Text(displayName)
                            .font(.headline)
                            .foregroundColor(Color(.label))
                        if isCurrentUser {
                            Text("(You)")
                                .foregroundColor(Color(.secondaryLabel))
                        }
                    }
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(Color(.secondaryLabel))
                }

                Spacer()

                if group != nil {
                    // Facepile for groups
                    HStack(spacing: -8) {
                        ForEach(players.prefix(3)) { player in
                            PlayerAvatar(player: player, size: 40)
                                .clipShape(Circle())
                                .overlay(
                                    Circle()
                                        .stroke(Color(.systemBackground), lineWidth: 2)
                                )
                        }
                        if players.count > 3 {
                            Text("+\(players.count - 3)")
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color(.systemGray5))
                                .clipShape(Capsule())
                        }
                    }
                } else if let player = players.first {
                    // Single avatar for individual players
                    PlayerAvatar(player: player, size: 40)
                        .clipShape(Circle())
                        .overlay(
                            Circle()
                                .stroke(Color.black.opacity(0.1), lineWidth: 1)
                        )
                }
            }
            .task {
                await loadMatches()
            }
        }
    }
#endif
