import AuthenticationServices
import SwiftData
import SwiftUI
import UserNotifications

#if canImport(UIKit)
    import UIKit
#else
    import AppKit
#endif

@MainActor
class AuthenticationManager: ObservableObject {
    @Published var isAuthenticated = false {
        didSet {
            print("🔐 Authentication state changed: \(isAuthenticated)")
        }
    }
    @Published var userID: String? {
        didSet {
            print("👤 UserID changed: \(userID ?? "nil")")
            Task {
                await updateOnlineStatus(isAuthenticated)
            }
        }
    }
    @Published var error: Error?
    @Published private(set) var isSyncing = false {
        didSet {
            print("🔄 Sync state changed: \(isSyncing)")
        }
    }

    private var modelContext: ModelContext?

    static let shared = AuthenticationManager()

    private init() {
        print("📱 AuthenticationManager initialized")
        setupNotifications()
    }

    func setModelContext(_ context: ModelContext) {
        self.modelContext = context
    }

    private func setupNotifications() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) {
            granted, error in
            if granted {
                print("✅ Notification permission granted")
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            } else if let error = error {
                print("❌ Notification permission error: \(error.localizedDescription)")
            }
        }
    }

    func checkExistingCredentials() async {
        print("🔍 Checking existing credentials...")
        let appleIDProvider = ASAuthorizationAppleIDProvider()
        if let userID = UserDefaults.standard.string(forKey: "userID") {
            do {
                let credentialState = try await appleIDProvider.credentialState(forUserID: userID)
                print("📍 Credential state for userID \(userID): \(credentialState.rawValue)")
                switch credentialState {
                case .authorized:
                    isAuthenticated = true
                    self.userID = userID
                    await syncUserProfile()
                default:
                    isAuthenticated = false
                    self.userID = nil
                    UserDefaults.standard.removeObject(forKey: "userID")
                }
            } catch {
                isAuthenticated = false
                self.userID = nil
                UserDefaults.standard.removeObject(forKey: "userID")
                print("❌ Error checking credentials: \(error.localizedDescription)")
            }
        } else {
            print("ℹ️ No existing userID found")
        }
    }

    func handleSignInWithAppleCompletion(credential: ASAuthorizationAppleIDCredential) async {
        print("🎯 Handling Sign In with Apple completion...")
        isSyncing = true
        defer { isSyncing = false }

        // Store user info
        self.userID = credential.user
        UserDefaults.standard.set(credential.user, forKey: "userID")

        if let fullName = credential.fullName {
            let givenName = fullName.givenName ?? ""
            let familyName = fullName.familyName ?? ""
            let userName = "\(givenName) \(familyName)"
            UserDefaults.standard.set(userName, forKey: "userName")
            print("📝 Stored user name: \(userName)")
        }
        if let email = credential.email {
            UserDefaults.standard.set(email, forKey: "userEmail")
            print("📧 Stored email: \(email)")
        }

        await syncUserProfile()

        print("⏳ Waiting for CloudKit sync...")
        try? await Task.sleep(nanoseconds: 1_000_000_000)  // 1 second
        isAuthenticated = true
        print("✅ Sign in complete!")
    }

    func signOut() {
        print("👋 Signing out...")
        Task {
            await updateOnlineStatus(false)
        }
        isAuthenticated = false
        userID = nil
        UserDefaults.standard.removeObject(forKey: "userID")
        UserDefaults.standard.removeObject(forKey: "userName")
        UserDefaults.standard.removeObject(forKey: "userEmail")
        print("✅ Sign out complete!")
    }

    // MARK: - Multiplayer Methods

    private func syncUserProfile() async {
        guard let userID = userID,
            let modelContext = modelContext
        else { return }

        print("🔄 Syncing user profile for \(userID)")

        let descriptor = FetchDescriptor<Player>(
            predicate: #Predicate<Player> { player in
                player.appleUserID == userID
            }
        )

        do {
            let existingPlayer = try modelContext.fetch(descriptor).first

            if let player = existingPlayer {
                // Update existing player
                player.isOnline = true
                player.lastSeen = Date()
                if player.name == nil {
                    player.name = UserDefaults.standard.string(forKey: "userName")
                }
            } else {
                // Create new player
                let userName = UserDefaults.standard.string(forKey: "userName") ?? "Player"
                let player = Player(name: userName, appleUserID: userID)
                player.isOnline = true
                player.lastSeen = Date()
                modelContext.insert(player)
            }

            try modelContext.save()
            print("✅ User profile synced successfully")
        } catch {
            print("❌ Error syncing user profile: \(error.localizedDescription)")
        }
    }

    private func updateOnlineStatus(_ isOnline: Bool) async {
        guard let userID = userID,
            let modelContext = modelContext
        else { return }

        print("🔄 Updating online status to \(isOnline) for \(userID)")

        let descriptor = FetchDescriptor<Player>(
            predicate: #Predicate<Player> { player in
                player.appleUserID == userID
            }
        )

        do {
            if let player = try modelContext.fetch(descriptor).first {
                player.isOnline = isOnline
                player.lastSeen = isOnline ? Date() : nil
                try modelContext.save()
                print("✅ Online status updated successfully")
            }
        } catch {
            print("❌ Error updating online status: \(error.localizedDescription)")
        }
    }

    func updateDeviceToken(_ deviceToken: String) {
        guard let userID = userID,
            let modelContext = modelContext
        else { return }

        print("🔄 Updating device token for \(userID)")

        Task {
            let descriptor = FetchDescriptor<Player>(
                predicate: #Predicate<Player> { player in
                    player.appleUserID == userID
                }
            )

            do {
                if let player = try modelContext.fetch(descriptor).first {
                    player.deviceToken = deviceToken
                    try modelContext.save()
                    print("✅ Device token updated successfully")
                }
            } catch {
                print("❌ Error updating device token: \(error.localizedDescription)")
            }
        }
    }
}

// Helper class to handle the sign-in process
private class SignInDelegate: NSObject, ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding
{
    let continuation: CheckedContinuation<ASAuthorization, Error>

    init(continuation: CheckedContinuation<ASAuthorization, Error>) {
        self.continuation = continuation
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        #if canImport(UIKit)
            let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
            return scene?.windows.first ?? UIWindow()
        #else
            return NSApplication.shared.windows.first ?? NSWindow()
        #endif
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        continuation.resume(returning: authorization)
    }

    func authorizationController(
        controller: ASAuthorizationController, didCompleteWithError error: Error
    ) {
        continuation.resume(throwing: error)
    }
}
