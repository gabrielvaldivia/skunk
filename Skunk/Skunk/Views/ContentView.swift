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

    struct ContentView: View {
        var body: some View {
            TabView {
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
                                    PlayerDetailView(player: player)
                                }
                        }
                }
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
                            PlayerDetailView(player: player)
                        }
                }
                .tabItem {
                    Label("Players", systemImage: "person.2")
                }

                NavigationStack {
                    ActivityView()
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbarBackground(.secondary.opacity(0.1), for: .navigationBar)
                }
                .tabItem {
                    Label("Activity", systemImage: "list.bullet")
                }

                NavigationStack {
                    SettingsView()
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbarBackground(.secondary.opacity(0.1), for: .navigationBar)
                }
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
            }
        }
    }
#endif
