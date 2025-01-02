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

            return result
        }

        private func generateSubtitle(
            matches: [Match], isLoading: Bool, currentPlayer: Player?, showOpponent: Bool,
            cloudKitManager: CloudKitManager
        ) -> String {
            if isLoading && matches.isEmpty {
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
        let group: PlayerGroup?
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @StateObject private var viewModel = MatchSubtitleViewModel()

        var body: some View {
            Text(subtitle)
                .font(.caption)
                .foregroundColor(Color(.secondaryLabel))
                .onChange(of: matches) { _ in
                    viewModel.invalidateCache()
                }
                .onChange(of: cachedMatches) { _ in
                    viewModel.invalidateCache()
                }
        }

        private var subtitle: String {
            // For groups, only use cached matches
            if let group = group {
                if let cached = cloudKitManager.getGroupMatches(group.id) {
                    print("🔵 PlayerRow: Using \(cached.count) cached matches for group subtitle")
                    return viewModel.subtitle(
                        for: cached, isLoading: false, currentPlayer: nil,
                        showOpponent: false, cloudKitManager: cloudKitManager)
                }
                return viewModel.subtitle(
                    for: [], isLoading: false, currentPlayer: nil,
                    showOpponent: false, cloudKitManager: cloudKitManager)
            }

            // For players, use cached matches first if available
            if let cached = cachedMatches, !cached.isEmpty {
                print("🔵 PlayerRow: Using \(cached.count) cached matches for subtitle")
                return viewModel.subtitle(
                    for: cached, isLoading: false, currentPlayer: currentPlayer,
                    showOpponent: showOpponent, cloudKitManager: cloudKitManager)
            }

            print(
                "🔵 PlayerRow: Using \(matches.count) matches for subtitle (loading: \(isLoading))")
            // Otherwise use matches and respect loading state
            return viewModel.subtitle(
                for: matches, isLoading: isLoading, currentPlayer: currentPlayer,
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
                let matches = cloudKitManager.getMatchesForGroup(group.id)
                print(
                    "🔵 PlayerRow: Got \(matches?.count ?? 0) cached matches for group \(group.id)")
                return matches
            } else if let player = player {
                let matches = cloudKitManager.getMatchesForPlayer(player.id)
                print(
                    "🔵 PlayerRow: Got \(matches?.count ?? 0) cached matches for player \(player.id)"
                )
                return matches
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
            isLoading = true
            do {
                if let player = player {
                    print("🔵 PlayerRow: Starting loadMatches for \(player.name)")
                    // Check cache first
                    if let cachedMatches = cloudKitManager.getPlayerMatches(player.id) {
                        print(
                            "🔵 PlayerRow: Got \(cachedMatches.count) cached matches for player \(player.id)"
                        )
                        matches = cachedMatches
                        isLoading = false
                        return
                    }
                    print("🔵 PlayerRow: No cached matches, loading from network")

                    // Load from network
                    print("🔵 PlayerRow: Starting network load for \(player.name)")
                    print("🔵 PlayerRow: Fetching matches for player \(player.id)")
                    let playerMatches = try await cloudKitManager.fetchRecentMatches(
                        forPlayer: player.id, limit: 10)
                    print("🔵 PlayerRow: Got \(playerMatches.count) matches for player")

                    // Cache the matches
                    if !playerMatches.isEmpty {
                        print("🔵 PlayerRow: Caching \(playerMatches.count) matches")
                        cloudKitManager.cachePlayerMatches(playerMatches, for: player.id)
                    } else {
                        print("🔵 PlayerRow: No matches found from network")
                    }
                    matches = playerMatches
                } else if let group = group {
                    print("🔵 PlayerRow: Starting loadMatches for group \(group.id)")
                    // Check cache first
                    if let cachedMatches = cloudKitManager.getGroupMatches(group.id) {
                        print(
                            "🔵 PlayerRow: Got \(cachedMatches.count) cached matches for group \(group.id)"
                        )
                        matches = cachedMatches
                        isLoading = false
                        return
                    }
                    print("🔵 PlayerRow: No cached matches, loading from network")

                    // Load from network
                    print("🔵 PlayerRow: Starting network load for group \(group.id)")
                    let groupMatches = try await cloudKitManager.fetchRecentMatches(
                        forGroup: group.id, limit: 10)
                    print("🔵 PlayerRow: Got \(groupMatches.count) matches for group")

                    // Cache the matches
                    if !groupMatches.isEmpty {
                        print("🔵 PlayerRow: Caching \(groupMatches.count) matches")
                        cloudKitManager.cacheGroupMatches(groupMatches, for: group.id)
                    } else {
                        print("🔵 PlayerRow: No matches found from network")
                    }
                    matches = groupMatches
                }
            } catch {
                print("🔴 PlayerRow: Error loading matches: \(error)")
            }
            isLoading = false
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
                        cachedMatches: cachedMatches,
                        group: group
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
