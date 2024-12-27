import AuthenticationServices
import SwiftData
import SwiftUI

@main
struct SkunkApp: App {
    @StateObject private var authManager = AuthenticationManager.shared

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Player.self,
            Game.self,
            Match.self,
            Score.self,
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .task {
                    await authManager.checkExistingCredentials()
                }
        }
        .modelContainer(sharedModelContainer)
    }
}
