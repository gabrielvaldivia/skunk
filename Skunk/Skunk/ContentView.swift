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
            NavigationStack {
                GamesView()
            }
            .tabItem {
                Label("Games", systemImage: "gamecontroller")
            }

            NavigationStack {
                PlayersView()
            }
            .tabItem {
                Label("Players", systemImage: "person.2")
            }
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(previewContainer)
}

private let previewContainer: ModelContainer = {
    let schema = Schema([
        Player.self,
        Game.self,
        Match.self,
        Score.self,
    ])
    let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: schema, configurations: [modelConfiguration])
    return container
}()
