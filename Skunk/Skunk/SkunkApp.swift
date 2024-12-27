import SwiftData
import SwiftUI

@main
struct SkunkApp: App {
    @StateObject private var authManager = AuthenticationManager()

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isAuthenticated {
                    ContentView()
                        .environmentObject(authManager)
                        .modelContainer(for: [Game.self, Match.self, Player.self, Score.self])
                } else {
                    SignInView()
                        .environmentObject(authManager)
                }
            }
            .task {
                await authManager.checkExistingCredentials()
            }
        }
    }
}
