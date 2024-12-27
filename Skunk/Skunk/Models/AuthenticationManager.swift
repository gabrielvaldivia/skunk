import AuthenticationServices
import CloudKit
import Foundation
import SwiftUI

#if canImport(UIKit)
    import UIKit

    @MainActor
    class AuthenticationManager: ObservableObject {
        @Published var isAuthenticated = false
        @Published var userID: String?
        @Published var error: Error?
        @Published private(set) var isSyncing = false
        @Published private(set) var isCheckingCredentials = false
        @Published private(set) var isDeletingAccount = false
        @Published private(set) var isSigningOut = false

        private var isSigningIn = false

        func checkExistingCredentials() async {
            guard !isCheckingCredentials && !isSigningIn else { return }

            isCheckingCredentials = true

            if let storedID = UserDefaults.standard.string(forKey: "userID") {
                do {
                    let appleIDProvider = ASAuthorizationAppleIDProvider()
                    let credentialState = try await appleIDProvider.credentialState(
                        forUserID: storedID)

                    switch credentialState {
                    case .authorized:
                        userID = storedID
                        isAuthenticated = true
                        // Try to find or create the user's player
                        if let player = try? await CloudKitManager.shared.fetchCurrentUserPlayer(
                            userID: storedID)
                        {
                            print("Found existing player: \(player.name)")
                        } else {
                            // Create new player if none exists
                            let newPlayer = Player(name: "Player", appleUserID: storedID)
                            try? await CloudKitManager.shared.savePlayer(newPlayer)
                        }
                    case .revoked, .notFound, .transferred:
                        UserDefaults.standard.removeObject(forKey: "userID")
                        userID = nil
                        isAuthenticated = false
                    @unknown default:
                        UserDefaults.standard.removeObject(forKey: "userID")
                        userID = nil
                        isAuthenticated = false
                    }
                } catch {
                    UserDefaults.standard.removeObject(forKey: "userID")
                    userID = nil
                    isAuthenticated = false
                }
            } else {
                isAuthenticated = false
            }

            isCheckingCredentials = false
        }

        func handleSignInWithApple(_ authorization: ASAuthorization) async throws {
            guard !isSigningIn else { return }

            isSigningIn = true
            isCheckingCredentials = true

            defer {
                isSigningIn = false
                isCheckingCredentials = false
            }

            guard
                let appleIDCredential = authorization.credential
                    as? ASAuthorizationAppleIDCredential
            else {
                throw AuthenticationError.invalidCredential
            }

            userID = appleIDCredential.user
            UserDefaults.standard.set(appleIDCredential.user, forKey: "userID")

            // Create or update player
            if let player = try? await CloudKitManager.shared.fetchCurrentUserPlayer(
                userID: appleIDCredential.user)
            {
                // Update existing player if needed
                if let fullName = appleIDCredential.fullName,
                    let givenName = fullName.givenName,
                    let familyName = fullName.familyName,
                    player.name == "Player"  // Only update if it's the default name
                {
                    var updatedPlayer = player
                    updatedPlayer.name = "\(givenName) \(familyName)"
                    try? await CloudKitManager.shared.updatePlayer(updatedPlayer)
                }
            } else {
                // Create new player
                let name: String
                if let fullName = appleIDCredential.fullName,
                    let givenName = fullName.givenName,
                    let familyName = fullName.familyName
                {
                    name = "\(givenName) \(familyName)"
                } else {
                    name = "Player"
                }

                let newPlayer = Player(
                    name: name,
                    appleUserID: appleIDCredential.user
                )
                try? await CloudKitManager.shared.savePlayer(newPlayer)
            }

            isAuthenticated = true
        }

        func signOut() async {
            guard !isSigningOut else { return }

            isSigningOut = true
            defer { isSigningOut = false }

            // Clear credentials and state
            UserDefaults.standard.removeObject(forKey: "userID")
            userID = nil
            isAuthenticated = false
            error = nil
            isSigningIn = false
        }

        func deleteAccount() async {
            guard let userID = userID else {
                self.error = AuthenticationError.missingCredential
                return
            }

            isDeletingAccount = true
            defer { isDeletingAccount = false }

            do {
                // Find and delete the user's player
                if let player = try? await CloudKitManager.shared.fetchCurrentUserPlayer(
                    userID: userID)
                {
                    try await CloudKitManager.shared.deletePlayer(player)
                }

                // Clear credentials and state
                UserDefaults.standard.removeObject(forKey: "userID")
                self.userID = nil
                isAuthenticated = false
                error = nil
                isSigningIn = false
            } catch {
                self.error = error
            }
        }
    }

    enum AuthenticationError: Error {
        case invalidCredential
        case missingCredential
        case deletionFailed
    }

    private class AuthorizationDelegate: NSObject, ASAuthorizationControllerDelegate,
        ASAuthorizationControllerPresentationContextProviding
    {
        let continuation: CheckedContinuation<ASAuthorization, Error>

        init(continuation: CheckedContinuation<ASAuthorization, Error>) {
            self.continuation = continuation
            super.init()
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

        func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
            if #available(iOS 15.0, *) {
                guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                    let window = scene.windows.first
                else {
                    return UIWindow()
                }
                return window
            } else {
                return UIApplication.shared.windows.first ?? UIWindow()
            }
        }
    }
#endif
