import AuthenticationServices
import SwiftData
import SwiftUI

@main
struct SkunkApp: App {
    @StateObject private var authManager = AuthenticationManager.shared
    let container: ModelContainer

    init() {
        do {
            let schema = Schema([
                Player.self,
                Game.self,
                Match.self,
                Score.self,
            ])

            let modelConfiguration = ModelConfiguration(
                schema: schema,
                isStoredInMemoryOnly: false,
                allowsSave: true,
                cloudKitDatabase: .automatic
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
                .sheet(
                    isPresented: .init(
                        get: { !authManager.isAuthenticated },
                        set: { _ in }
                    )
                ) {
                    SignInView()
                }
        }
        .modelContainer(container)
    }
}
