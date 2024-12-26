import AuthenticationServices
import SwiftUI

#if canImport(UIKit)
    import UIKit
#else
    import AppKit
#endif

@MainActor
class AuthenticationManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var userID: String?
    @Published var error: Error?

    static let shared = AuthenticationManager()

    private init() {
        // No-op, use create() instead
    }

    static func create() async -> AuthenticationManager {
        let manager = AuthenticationManager.shared
        await manager.checkExistingCredentials()
        return manager
    }

    private func checkExistingCredentials() async {
        let appleIDProvider = ASAuthorizationAppleIDProvider()
        if let userID = UserDefaults.standard.string(forKey: "userID") {
            do {
                let credentialState = try await appleIDProvider.credentialState(forUserID: userID)
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
                print("Error checking credentials: \(error.localizedDescription)")
            }
        }
    }

    func signIn() async {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]

        do {
            let result = try await withCheckedThrowingContinuation { continuation in
                let controller = ASAuthorizationController(authorizationRequests: [request])
                let delegate = SignInDelegate(continuation: continuation)
                controller.delegate = delegate
                controller.presentationContextProvider = delegate
                controller.performRequests()

                // Store delegate to prevent it from being deallocated
                objc_setAssociatedObject(controller, "delegate", delegate, .OBJC_ASSOCIATION_RETAIN)
            }

            if let appleIDCredential = result as? ASAuthorizationAppleIDCredential {
                DispatchQueue.main.async {
                    self.userID = appleIDCredential.user
                    UserDefaults.standard.set(appleIDCredential.user, forKey: "userID")
                    self.isAuthenticated = true

                    // Store user info if this is the first sign in
                    if let fullName = appleIDCredential.fullName {
                        let givenName = fullName.givenName ?? ""
                        let familyName = fullName.familyName ?? ""
                        UserDefaults.standard.set("\(givenName) \(familyName)", forKey: "userName")
                    }
                    if let email = appleIDCredential.email {
                        UserDefaults.standard.set(email, forKey: "userEmail")
                    }
                }
            }
        } catch {
            DispatchQueue.main.async {
                self.error = error
                print("Sign in failed: \(error.localizedDescription)")
            }
        }
    }

    func signOut() {
        isAuthenticated = false
        userID = nil
        UserDefaults.standard.removeObject(forKey: "userID")
        UserDefaults.standard.removeObject(forKey: "userName")
        UserDefaults.standard.removeObject(forKey: "userEmail")
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
