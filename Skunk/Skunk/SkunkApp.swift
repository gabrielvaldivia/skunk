import SwiftUI

#if canImport(FirebaseAnalytics)
    import FirebaseAnalytics
    import FirebaseCore
#endif

#if canImport(UIKit)
    import UIKit

    class AppDelegate: NSObject, UIApplicationDelegate {
        func application(
            _ application: UIApplication,
            didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? =
                nil
        ) -> Bool {
            #if canImport(FirebaseAnalytics)
                FirebaseApp.configure()
            #endif
            return true
        }
    }

    @main
    struct SkunkApp: App {
        @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
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
                        #if canImport(FirebaseAnalytics)
                            Analytics.logEvent(
                                "app_initialization_error",
                                parameters: [
                                    "error_description": error.localizedDescription
                                ])
                        #endif
                    }
                    isInitializing = false
                }
            }
        }
    }
#endif
