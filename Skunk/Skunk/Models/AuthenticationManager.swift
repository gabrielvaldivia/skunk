import AuthenticationServices
import CloudKit
import FirebaseAnalytics
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
                print("🔴 AuthenticationManager: Invalid credential type")
                Analytics.logEvent(
                    "sign_in_error",
                    parameters: [
                        "error_type": "invalid_credential"
                    ])
                throw AuthenticationError.invalidCredential
            }

            userID = appleIDCredential.user
            UserDefaults.standard.set(appleIDCredential.user, forKey: "userID")

            // Set the Apple user ID in the CloudKit user record
            do {
                let container = CKContainer(identifier: "iCloud.com.gvaldivia.skunkapp")
                let recordID = try await container.userRecordID()
                let database = container.publicCloudDatabase
                let userRecord = try await database.record(for: recordID)
                userRecord["appleUserID"] = appleIDCredential.user as CKRecordValue
                _ = try await database.save(userRecord)
                print("🟢 AuthenticationManager: Saved Apple user ID to CloudKit user record")
            } catch {
                print("🔴 AuthenticationManager: Failed to save Apple user ID to CloudKit: \(error)")
            }

            // Create or update player
            do {
                print(
                    "🟢 AuthenticationManager: Starting player creation/update for user \(appleIDCredential.user)"
                )

                if let player = try await CloudKitManager.shared.fetchCurrentUserPlayer(
                    userID: appleIDCredential.user)
                {
                    print("🟢 AuthenticationManager: Found existing player")
                    Analytics.logEvent(
                        "player_found",
                        parameters: [
                            "player_name": player.name
                        ])
                    // Update existing player if needed
                    if let fullName = appleIDCredential.fullName,
                        let givenName = fullName.givenName,
                        player.name == "Player"  // Only update if it's the default name
                    {
                        var updatedPlayer = player
                        updatedPlayer.name = givenName
                        do {
                            try await CloudKitManager.shared.updatePlayer(updatedPlayer)
                            print(
                                "🟢 AuthenticationManager: Successfully updated player name to \(updatedPlayer.name)"
                            )
                            Analytics.logEvent(
                                "player_name_updated",
                                parameters: [
                                    "new_name": updatedPlayer.name
                                ])
                        } catch {
                            print(
                                "🔴 AuthenticationManager: Failed to update player name: \(error.localizedDescription)"
                            )
                            Analytics.logEvent(
                                "player_update_error",
                                parameters: [
                                    "error_description": error.localizedDescription
                                ])
                        }
                    }
                } else {
                    print("🟢 AuthenticationManager: No existing player found, creating new one")
                    // Create new player
                    let name: String
                    if let fullName = appleIDCredential.fullName,
                        let givenName = fullName.givenName
                    {
                        name = givenName
                    } else {
                        name = "Player"
                    }

                    print("🟢 AuthenticationManager: Creating new player with name: \(name)")
                    let newPlayer = Player(
                        name: name,
                        appleUserID: appleIDCredential.user
                    )
                    do {
                        try await CloudKitManager.shared.savePlayer(newPlayer)
                        print("🟢 AuthenticationManager: Successfully created new player")
                        Analytics.logEvent(
                            "new_player_created",
                            parameters: [
                                "player_name": name
                            ])
                    } catch let error as CKError {
                        print(
                            "🔴 AuthenticationManager: CloudKit error creating player: \(error.localizedDescription)"
                        )
                        print("🔴 AuthenticationManager: Error code: \(error.code.rawValue)")
                        Analytics.logEvent(
                            "player_creation_error",
                            parameters: [
                                "error_type": "cloudkit",
                                "error_code": String(error.code.rawValue),
                                "error_description": error.localizedDescription,
                            ])
                        if error.code == .serverRejectedRequest {
                            print(
                                "🔴 AuthenticationManager: Server rejected the request. This might be a CloudKit permissions issue."
                            )
                        }
                        throw error
                    } catch {
                        print(
                            "🔴 AuthenticationManager: Unknown error creating player: \(error.localizedDescription)"
                        )
                        Analytics.logEvent(
                            "player_creation_error",
                            parameters: [
                                "error_type": "unknown",
                                "error_description": error.localizedDescription,
                            ])
                        throw error
                    }
                }
            } catch let error as CKError {
                print(
                    "🔴 AuthenticationManager: CloudKit error in player handling: \(error.localizedDescription)"
                )
                print("🔴 AuthenticationManager: Error code: \(error.code.rawValue)")
                Analytics.logEvent(
                    "cloudkit_error",
                    parameters: [
                        "error_code": String(error.code.rawValue),
                        "error_description": error.localizedDescription,
                    ])
                if error.code == .networkFailure {
                    throw AuthenticationError.networkError
                } else if error.code == .serverRejectedRequest {
                    throw AuthenticationError.cloudKitPermissionError
                } else {
                    throw error
                }
            } catch {
                print(
                    "🔴 AuthenticationManager: Error in player handling: \(error.localizedDescription)"
                )
                Analytics.logEvent(
                    "authentication_error",
                    parameters: [
                        "error_description": error.localizedDescription
                    ])
                throw error
            }

            isAuthenticated = true
            Analytics.logEvent("sign_in_success", parameters: nil)
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

    enum AuthenticationError: LocalizedError {
        case invalidCredential
        case missingCredential
        case deletionFailed
        case networkError
        case cloudKitPermissionError

        var errorDescription: String? {
            switch self {
            case .invalidCredential:
                return "Invalid Sign in with Apple credentials"
            case .missingCredential:
                return "Missing authentication credentials"
            case .deletionFailed:
                return "Failed to delete account"
            case .networkError:
                return
                    "Network error occurred. Please check your internet connection and try again."
            case .cloudKitPermissionError:
                return
                    "Unable to access iCloud. Please make sure you're signed into iCloud and have given the app permission to access it."
            }
        }
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
