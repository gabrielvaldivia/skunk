import SwiftUI

#if canImport(UIKit)
    import UIKit

    @main
    struct SkunkApp: App {
        @StateObject private var authManager = AuthenticationManager()
        @StateObject private var cloudKitManager = CloudKitManager.shared
        @State private var isInitializing = true

        var body: some Scene {
            WindowGroup {
                Group {
                    if isInitializing {
                        ProgressView()
                    } else if authManager.isAuthenticated {
                        ContentView()
                            .environmentObject(authManager)
                            .environmentObject(cloudKitManager)
                    } else {
                        SignInView()
                            .environmentObject(authManager)
                    }
                }
                .task {
                    do {
                        // Setup CloudKit schema first
                        try await cloudKitManager.setupSchema()
                        // Setup subscriptions
                        try await cloudKitManager.setupSubscriptions()
                        // Then check credentials
                        await authManager.checkExistingCredentials()
                    } catch {
                        print(
                            "🔴 SkunkApp: Error during initialization: \(error.localizedDescription)"
                        )
                    }
                    isInitializing = false
                }
            }
        }
    }
#endif
