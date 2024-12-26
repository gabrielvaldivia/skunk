import AuthenticationServices
import SwiftData
import SwiftUI

@main
struct SkunkApp: App {
    @State private var authManager: AuthenticationManager?
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
            Group {
                if let authManager = authManager {
                    ContentView()
                        .onAppear {
                            showSignIn = !authManager.isAuthenticated
                        }
                        .sheet(
                            isPresented: $showSignIn,
                            onDismiss: {
                                // Force refresh the view when sheet is dismissed
                                if authManager.isAuthenticated {
                                    try? container.mainContext.save()
                                }
                            }
                        ) {
                            SignInView(isPresented: $showSignIn)
                        }
                } else {
                    ProgressView()
                        .task {
                            authManager = await AuthenticationManager.create()
                        }
                }
            }
        }
        .modelContainer(container)
    }
}
