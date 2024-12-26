//
//  ContentView.swift
//  Skunk
//
//  Created by Gabriel Valdivia on 12/24/24.
//

import SwiftData
import SwiftUI

struct ContentView: View {
    var body: some View {
        NavigationStack {
            TabView {
                NavigationView {
                    GamesView()
                }
                .tabItem {
                    Label("Games", systemImage: "gamecontroller")
                }

                NavigationView {
                    PlayersView()
                }
                .tabItem {
                    Label("Players", systemImage: "person.2")
                }

                NavigationView {
                    SettingsView()
                }
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
            }
        }
    }
}
