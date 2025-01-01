//
//  ContentView.swift
//  Skunk
//
//  Created by Gabriel Valdivia on 12/24/24.
//

import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct AsyncPlayerDetailView: View {
        let player: Player
        @State private var loadedView: PlayerDetailView?
        @State private var isLoading = true
        @EnvironmentObject private var cloudKitManager: CloudKitManager

        var body: some View {
            Group {
                if let loadedView {
                    loadedView
                } else {
                    ProgressView()
                }
            }
            .task {
                loadedView = await PlayerDetailView.create(player: player)
                isLoading = false
            }
        }
    }

    struct ContentView: View {
        @State private var selectedTab = 0
        @State private var showingNewMatch = false
        @State private var previousTab = 0

        var body: some View {
            TabView(selection: $selectedTab) {
                NavigationStack {
                    GamesView()
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbarBackground(.secondary.opacity(0.1), for: .navigationBar)
                        .navigationDestination(for: Game.self) { game in
                            GameDetailView(game: game)
                                .navigationDestination(for: Match.self) { match in
                                    MatchDetailView(match: match)
                                }
                                .navigationDestination(for: Player.self) { player in
                                    AsyncPlayerDetailView(player: player)
                                }
                        }
                }
                .tag(0)
                .tabItem {
                    Label("Games", systemImage: "gamecontroller")
                }

                NavigationStack {
                    PlayersView()
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbarBackground(.secondary.opacity(0.1), for: .navigationBar)
                        .navigationDestination(for: Match.self) { match in
                            MatchDetailView(match: match)
                        }
                        .navigationDestination(for: Player.self) { player in
                            AsyncPlayerDetailView(player: player)
                        }
                }
                .tag(1)
                .tabItem {
                    Label("Players", systemImage: "person.2")
                }

                // Color.clear
                //     .tag(2)
                //     .tabItem {
                //         Label("New Match", systemImage: "plus.circle.fill")
                //     }

                NavigationStack {
                    ActivityView()
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbarBackground(.secondary.opacity(0.1), for: .navigationBar)
                }
                .tag(3)
                .tabItem {
                    Label("Activity", systemImage: "list.bullet")
                }

                NavigationStack {
                    SettingsView()
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbarBackground(.secondary.opacity(0.1), for: .navigationBar)
                }
                .tag(4)
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
            }
            .onChange(of: selectedTab) { oldValue, newValue in
                if newValue == 2 {
                    previousTab = oldValue
                    showingNewMatch = true
                    selectedTab = previousTab
                }
            }
            .sheet(isPresented: $showingNewMatch) {
                NewMatchView()
            }
        }
    }
#endif
