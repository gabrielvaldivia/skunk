//
//  SkunkApp.swift
//  Skunk
//
//  Created by Gabriel Valdivia on 12/24/24.
//

import SwiftData
import SwiftUI

@main
struct SkunkApp: App {
    let container: ModelContainer

    init() {
        do {
            let schema = Schema([
                Player.self,
                Game.self,
                Match.self,
                Tournament.self,
                Score.self,
            ])

            let modelConfiguration = ModelConfiguration(
                schema: schema,
                isStoredInMemoryOnly: false,
                allowsSave: true
            )

            container = try ModelContainer(
                for: schema,
                migrationPlan: nil,
                configurations: [modelConfiguration]
            )
        } catch {
            fatalError("Could not initialize ModelContainer: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(container)
    }
}
