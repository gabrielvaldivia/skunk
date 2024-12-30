import SwiftUI

#if canImport(UIKit)
    struct GroupRowLink: View {
        let group: PlayerGroup

        var body: some View {
            NavigationLink {
                PlayerGroupDetailView(group: group)
            } label: {
                PlayerRow(
                    player: nil,
                    group: group
                )
                .padding(.vertical, 12)
            }
            .tint(.primary)
        }
    }

    struct EmptyGroupsView: View {
        var body: some View {
            HStack {
                Text("No groups found")
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.vertical, 8)
        }
    }

    struct GroupsListView: View {
        let groups: [PlayerGroup]
        let groupMatches: [String: [Match]]

        var body: some View {
            VStack(alignment: .leading, spacing: 0) {
                if groups.isEmpty {
                    EmptyGroupsView()
                } else {
                    ForEach(groups) { group in
                        GroupRowLink(group: group)
                        if group.id != groups.last?.id {
                            Divider()
                                .padding(.horizontal, -20)
                        }
                    }
                }
            }
        }
    }

    struct PlayerGroupsView: View {
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @State private var error: Error?
        @State private var showingError = false
        @State private var groupMatches: [String: [Match]] = [:]
        @State private var isLoading = true

        var body: some View {
            Group {
                if isLoading {
                    VStack {
                        ProgressView()
                            .padding()
                    }
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            GroupsListView(
                                groups: cloudKitManager.playerGroups,
                                groupMatches: groupMatches
                            )
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 16)
                    }
                }
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
            await MainActor.run { isLoading = true }
            do {
                let newGroupMatches = try await cloudKitManager.loadGroupsAndMatches()
                await MainActor.run {
                    groupMatches = newGroupMatches
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.error = error
                    showingError = true
                    isLoading = false
                }
            }
        }
    }
#endif
