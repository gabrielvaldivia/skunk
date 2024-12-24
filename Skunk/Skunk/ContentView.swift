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
        TabView {
            GamesView()
                .tabItem {
                    Label("Games", systemImage: "gamecontroller")
                }

            PlayersView()
                .tabItem {
                    Label("Players", systemImage: "person.2")
                }

            TournamentsView()
                .tabItem {
                    Label("Tournaments", systemImage: "trophy")
                }
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(
            for: [
                Player.self,
                Game.self,
                Match.self,
                Tournament.self,
                Score.self,
            ],
            inMemory: true)
}
