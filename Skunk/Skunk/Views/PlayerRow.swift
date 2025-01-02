import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    @MainActor
    class MatchSubtitleViewModel: ObservableObject {
        private var subtitleCache: [String: String] = [:]
        private let dateFormatter = RelativeDateTimeFormatter()

        init() {
            dateFormatter.unitsStyle = .full
        }

        func subtitle(
            for matches: [Match], isLoading: Bool, currentPlayer: Player?, showOpponent: Bool,
            cloudKitManager: CloudKitManager
        ) -> String {
            // Generate a cache key based on the input parameters
            let cacheKey =
                "\(matches.first?.id ?? "none")-\(isLoading)-\(currentPlayer?.id ?? "none")-\(showOpponent)"

            // Return cached value if available
            if let cached = subtitleCache[cacheKey] {
                return cached
            }

            // Generate subtitle
            let result = generateSubtitle(
                matches: matches, isLoading: isLoading, currentPlayer: currentPlayer,
                showOpponent: showOpponent, cloudKitManager: cloudKitManager)

            // Cache the result
            subtitleCache[cacheKey] = result

            // Cleanup cache if it gets too large
            if subtitleCache.count > 100 {
                subtitleCache = [:]
            }

            return result
        }

        private func generateSubtitle(
            matches: [Match], isLoading: Bool, currentPlayer: Player?, showOpponent: Bool,
            cloudKitManager: CloudKitManager
        ) -> String {
            if matches.isEmpty && !isLoading {
                return "No matches yet"
            }

            if matches.isEmpty && isLoading {
                return "Loading..."
            }

            guard let lastMatch = matches.first else {
                return "No matches yet"
            }

            let timeAgo = dateFormatter.localizedString(for: lastMatch.date, relativeTo: Date())

            if showOpponent {
                guard let player = currentPlayer else { return "No matches yet" }

                let otherPlayers = lastMatch.playerIDs
                    .filter { $0 != player.id }
                    .compactMap { cloudKitManager.getPlayer(id: $0) }

                guard let opponent = otherPlayers.first else {
                    return "No matches yet"
                }

                return "Last played against \(opponent.name) \(timeAgo)"
            } else {
                guard let game = lastMatch.game else { return "No matches yet" }
                return "Last played \(game.title) \(timeAgo)"
            }
        }

        func invalidateCache() {
            subtitleCache.removeAll()
        }
    }

    struct MatchSubtitle: View {
        let matches: [Match]
        let isLoading: Bool
        let currentPlayer: Player?
        let showOpponent: Bool
        let cachedMatches: [Match]?
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @StateObject private var viewModel = MatchSubtitleViewModel()

        var body: some View {
            Text(subtitle)
                .font(.caption)
                .foregroundColor(Color(.secondaryLabel))
                .onChange(of: matches) { _ in
                    viewModel.invalidateCache()
                }
        }

        private var subtitle: String {
            // Use cached matches first if available
            let matchesToUse = cachedMatches ?? matches
            return viewModel.subtitle(
                for: matchesToUse, isLoading: isLoading, currentPlayer: currentPlayer,
                showOpponent: showOpponent, cloudKitManager: cloudKitManager)
        }
    }

    struct PlayerRow: View {
        let player: Player?
        let group: PlayerGroup?
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @EnvironmentObject private var authManager: AuthenticationManager
        @State private var matches: [Match] = []
        @State private var isLoading = false

        private var cachedMatches: [Match]? {
            if let group = group {
                return cloudKitManager.getMatchesForGroup(group.id)
            } else if let player = player {
                return cloudKitManager.getMatchesForPlayer(player.id)
            }
            return nil
        }

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
            // If we have cached matches, don't block on loading
            if cachedMatches != nil {
                Task {
                    await loadMatchesFromNetwork()
                }
                return
            }

            await loadMatchesFromNetwork()
        }

        private func loadMatchesFromNetwork() async {
            guard !isLoading else { return }
            isLoading = true
            defer { isLoading = false }

            do {
                var allMatches: [Match] = []

                if let group = group {
                    // For groups, fetch only the most recent match
                    let recentMatches = try await cloudKitManager.fetchRecentMatches(
                        forGroup: group.id, limit: 1
                    )
                    if let lastMatch = recentMatches.first {
                        allMatches = [lastMatch]
                    }
                } else if let player = player {
                    // For players, fetch only the most recent match
                    let recentMatches = try await cloudKitManager.fetchRecentMatches(
                        forPlayer: player.id, limit: 1
                    )
                    if let lastMatch = recentMatches.first {
                        allMatches = [lastMatch]
                    }
                }

                if !allMatches.isEmpty {
                    if let group = group {
                        cloudKitManager.cacheMatchesForGroup(allMatches, groupId: group.id)
                    } else if let player = player {
                        cloudKitManager.cacheMatchesForPlayer(allMatches, playerId: player.id)
                    }
                    await MainActor.run {
                        matches = allMatches
                    }
                }
            } catch {
                print("Error loading matches: \(error)")
            }
        }

        var body: some View {
            HStack {
                VStack(alignment: .leading) {
                    HStack {
                        Text(displayName)
                            .font(.body)
                            .fontWeight(.semibold)
                            .foregroundColor(Color(.label))
                        if isCurrentUser {
                            Text("(You)")
                                .foregroundColor(Color(.secondaryLabel))
                        }
                    }
                    MatchSubtitle(
                        matches: matches,
                        isLoading: isLoading,
                        currentPlayer: player,
                        showOpponent: false,
                        cachedMatches: cachedMatches
                    )
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
