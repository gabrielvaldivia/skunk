import SwiftUI

#if canImport(UIKit)
    struct PlayerGroupsView: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var error: Error?
        @State private var showingError = false
        @State private var groupMatches: [String: [Match]] = [:]

        var body: some View {
            ScrollView {
                // All Groups container
                VStack(alignment: .leading, spacing: 20) {
                    // Groups section
                    VStack(alignment: .leading, spacing: 0) {
                        if cloudKitManager.playerGroups.isEmpty {
                            HStack {
                                Text("No groups found")
                                    .foregroundStyle(.secondary)
                                Spacer()
                            }
                            .padding(.vertical, 8)
                        } else {
                            ForEach(cloudKitManager.playerGroups) { group in
                                NavigationLink {
                                    PlayerGroupDetailView(group: group)
                                } label: {
                                    PlayerGroupRow(
                                        group: group, matches: groupMatches[group.id] ?? []
                                    )
                                    .padding(.vertical, 12)
                                }
                                .tint(.primary)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical)
            }
            .task {
                await loadGroupsAndMatches()
            }
            .refreshable {
                await loadGroupsAndMatches()
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(error?.localizedDescription ?? "An unknown error occurred")
            }
        }

        private func loadGroupsAndMatches() async {
            do {
                let groups = try await cloudKitManager.fetchPlayerGroups()

                // Load matches for each group
                for group in groups {
                    let games = try await cloudKitManager.fetchGames()
                    var allMatches: [Match] = []

                    for game in games {
                        let gameMatches = try await cloudKitManager.fetchMatches(for: game)
                        let groupMatches = gameMatches.filter { match in
                            Set(match.playerIDs) == Set(group.playerIDs)
                        }
                        allMatches.append(contentsOf: groupMatches)
                    }

                    groupMatches[group.id] = allMatches.sorted { $0.date > $1.date }
                }
            } catch {
                self.error = error
                showingError = true
            }
        }
    }

    struct PlayerGroupRow: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        let group: PlayerGroup
        let matches: [Match]

        private var playerNames: String {
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
        }

        private var players: [Player] {
            group.playerIDs.compactMap { id in
                cloudKitManager.getPlayer(id: id)
            }
        }

        private var lastMatchInfo: String {
            if let lastMatch = matches.first, let game = lastMatch.game {
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
                    Text(group.name)
                        .font(.body)
                    Text(lastMatchInfo)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                // Facepile
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
            }
        }
    }
#endif
