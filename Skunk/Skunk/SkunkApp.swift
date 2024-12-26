import AuthenticationServices
import SwiftData
import SwiftUI

@main
struct SkunkApp: App {
    @StateObject private var authManager = AuthenticationManager.shared
    @State private var showSignIn = false
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
                .task {
                    await authManager.checkExistingCredentials()
                }
                .sheet(
                    isPresented: .init(
                        get: { !authManager.isAuthenticated },
                        set: { _ in }
                    )
                ) {
                    SignInView()
                }
                .modelContainer(container)
                .onChange(of: authManager.isAuthenticated) { _, isAuthenticated in
                    if isAuthenticated {
                        // Give CloudKit time to sync before allowing further actions
                        Task {
                            try? await Task.sleep(nanoseconds: 1_000_000_000)  // 1 second
                            try? container.mainContext.save()
                        }
                    }
                }
        }
    }
}
