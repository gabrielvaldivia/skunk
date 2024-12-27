import AuthenticationServices
import Foundation
import ObjectiveC
import SwiftData
import SwiftUI
import UserNotifications

#if canImport(UIKit)
    import UIKit

    @MainActor
    class AuthenticationManager: ObservableObject {
        @Published var isAuthenticated = false
        @Published var userID: String?
        @Published var error: Error?
        @Published private(set) var isSyncing = false
        @Published private(set) var isCheckingCredentials = false

        private var modelContext: ModelContext?
        private var isSigningIn = false
        private var isResettingStore = false

        func setModelContext(_ context: ModelContext) {
            modelContext = context
            Task {
                await checkExistingCredentials()
            }
        }

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
                        await syncPlayers()
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

            // Wait for any pending store operations to complete
            try? await Task.sleep(nanoseconds: 1_000_000_000)  // 1 second

            userID = appleIDCredential.user
            UserDefaults.standard.set(appleIDCredential.user, forKey: "userID")

            // Handle full name
            if let fullName = appleIDCredential.fullName,
                let givenName = fullName.givenName,
                let familyName = fullName.familyName
            {
                await updatePlayerName("\(givenName) \(familyName)")
            }

            await syncPlayers()
            isAuthenticated = true
        }

        private func updatePlayerPhoto(_ photoData: Data) async {
            guard let modelContext, let userID else { return }
            do {
                let descriptor = FetchDescriptor<Player>(
                    predicate: #Predicate<Player> { player in
                        player.appleUserID == userID
                    }
                )
                let currentPlayers = try modelContext.fetch(descriptor)
                if let currentPlayer = currentPlayers.first {
                    currentPlayer.photoData = photoData
                    try modelContext.save()
                }
            } catch {
                print("❌ Error updating player photo: \(error)")
                self.error = error
            }
        }

        private func syncPlayers() {
            guard let modelContext = modelContext else { return }

            do {
                // Find current user's player
                let currentPlayers = try modelContext.fetch(
                    FetchDescriptor<Player>(
                        predicate: #Predicate<Player> { $0.appleUserID == userID }
                    )
                )

                // Create or update current user's player
                if let currentPlayer = currentPlayers.first {
                    // Nothing to update since we removed online status
                } else {
                    let newPlayer = Player(name: "Player")
                    newPlayer.appleUserID = userID
                    modelContext.insert(newPlayer)
                }

                try modelContext.save()
            } catch {
                print("❌ Error syncing players: \(error)")
                self.error = error
            }
        }

        func updatePlayerName(_ name: String) async {
            guard let modelContext, let userID else { return }
            do {
                let descriptor = FetchDescriptor<Player>(
                    predicate: #Predicate<Player> { player in
                        player.appleUserID == userID
                    }
                )
                let currentPlayers = try modelContext.fetch(descriptor)
                if let currentPlayer = currentPlayers.first {
                    // Only update name if it's not already set
                    if currentPlayer.name == nil {
                        currentPlayer.name = name
                        try modelContext.save()
                    }
                }
            } catch {
                print("❌ Error updating player name: \(error)")
                self.error = error
            }
        }

        private func resetStore() async {
            guard let modelContext = modelContext, !isResettingStore else { return }

            isResettingStore = true
            do {
                // Delete all Player objects
                let descriptor = FetchDescriptor<Player>()
                let allPlayers = try modelContext.fetch(descriptor)
                for player in allPlayers {
                    modelContext.delete(player)
                }
                try modelContext.save()

                // Wait for changes to be processed
                try await Task.sleep(nanoseconds: 1_000_000_000)  // 1 second
            } catch {
                print("❌ Error resetting store: \(error)")
                self.error = error
            }
            isResettingStore = false
        }

        func signOut() async {
            await resetStore()
            UserDefaults.standard.removeObject(forKey: "userID")
            userID = nil
            isAuthenticated = false

            // Wait for store to finish cleanup
            try? await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds
        }

        func signIn() async {
            do {
                let appleIDProvider = ASAuthorizationAppleIDProvider()
                let request = appleIDProvider.createRequest()
                request.requestedScopes = [.fullName]

                let authorization = try await withCheckedThrowingContinuation { continuation in
                    let controller = ASAuthorizationController(authorizationRequests: [request])
                    let delegate = AuthorizationDelegate(continuation: continuation)
                    controller.delegate = delegate
                    controller.presentationContextProvider = delegate
                    controller.performRequests()
                    // Keep the delegate alive until the request completes
                    objc_setAssociatedObject(
                        controller,
                        "delegate",
                        delegate,
                        .OBJC_ASSOCIATION_RETAIN
                    )
                }

                try await handleSignInWithApple(authorization)
            } catch {
                print("❌ Error signing in: \(error)")
                self.error = error
            }
        }
    }

    enum AuthenticationError: Error {
        case invalidCredential
        case missingCredential
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
