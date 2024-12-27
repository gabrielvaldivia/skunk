import SwiftUI

#if canImport(UIKit)
    import UIKit

    @main
    struct SkunkApp: App {
        @StateObject private var authManager = AuthenticationManager()
        @StateObject private var cloudKitManager = CloudKitManager.shared

        var body: some Scene {
            WindowGroup {
                Group {
                    if authManager.isAuthenticated {
                        ContentView()
                            .environmentObject(authManager)
                            .environmentObject(cloudKitManager)
                    } else {
                        SignInView()
                            .environmentObject(authManager)
                    }
                }
                .task {
                    // Setup CloudKit schema first
                    try? await cloudKitManager.setupSchema()
                    // Then check credentials
                    await authManager.checkExistingCredentials()
                }
            }
        }
    }
#endif
