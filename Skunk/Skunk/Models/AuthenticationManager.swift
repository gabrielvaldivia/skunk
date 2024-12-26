import AuthenticationServices
import SwiftUI

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
        }
    }
    @Published var error: Error?
    @Published private(set) var isSyncing = false {
        didSet {
            print("🔄 Sync state changed: \(isSyncing)")
        }
    }

    static let shared = AuthenticationManager()

    private init() {
        print("📱 AuthenticationManager initialized")
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

        print("⏳ Waiting for CloudKit sync...")
        try? await Task.sleep(nanoseconds: 1_000_000_000)  // 1 second
        isAuthenticated = true
        print("✅ Sign in complete!")
    }

    func signOut() {
        print("👋 Signing out...")
        isAuthenticated = false
        userID = nil
        UserDefaults.standard.removeObject(forKey: "userID")
        UserDefaults.standard.removeObject(forKey: "userName")
        UserDefaults.standard.removeObject(forKey: "userEmail")
        print("✅ Sign out complete!")
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
