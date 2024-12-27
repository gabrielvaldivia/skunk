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
    @Published var isAuthenticated = false
    @Published var userID: String?
    @Published var error: Error?
    @Published private(set) var isSyncing = false
    @Published private(set) var isCheckingCredentials = false

    private var modelContext: ModelContext?
    private var isSigningIn = false

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
                let credentialState = try await appleIDProvider.credentialState(forUserID: storedID)

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

        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential
        else {
            throw AuthenticationError.invalidCredential
        }

        userID = appleIDCredential.user
        UserDefaults.standard.set(appleIDCredential.user, forKey: "userID")

        if let givenName = appleIDCredential.fullName?.givenName,
            let familyName = appleIDCredential.fullName?.familyName
        {
            await updatePlayerName("\(givenName) \(familyName)")
        }

        await syncPlayers()
        isAuthenticated = true
    }

    private func syncPlayers() async {
        guard let modelContext, let userID else { return }
        isSyncing = true
        defer { isSyncing = false }

        do {
            // Fetch current user's player record
            let descriptor = FetchDescriptor<Player>(
                predicate: #Predicate<Player> { player in
                    player.appleUserID == userID
                }
            )
            let currentPlayers = try modelContext.fetch(descriptor)

            // Create or update current user's player
            if let currentPlayer = currentPlayers.first {
                currentPlayer.isOnline = isAuthenticated
                currentPlayer.lastSeen = Date()
            } else {
                let newPlayer = Player(name: "Player")
                newPlayer.appleUserID = userID
                newPlayer.isOnline = isAuthenticated
                newPlayer.lastSeen = Date()
                modelContext.insert(newPlayer)
            }

            try modelContext.save()
        } catch {
            print("❌ Error syncing players: \(error)")
            self.error = error
        }
    }

    private func updateOnlineStatus(_ isOnline: Bool) async {
        guard let modelContext, let userID else { return }
        do {
            // Update current user's online status
            let descriptor = FetchDescriptor<Player>(
                predicate: #Predicate<Player> { player in
                    player.appleUserID == userID
                }
            )
            let currentPlayers = try modelContext.fetch(descriptor)
            if let currentPlayer = currentPlayers.first {
                currentPlayer.isOnline = isOnline
                currentPlayer.lastSeen = isOnline ? Date() : currentPlayer.lastSeen
                try modelContext.save()
            }
        } catch {
            print("❌ Error updating online status: \(error)")
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

    func signOut() async {
        await updateOnlineStatus(false)
        UserDefaults.standard.removeObject(forKey: "userID")
        userID = nil
        isAuthenticated = false
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
        #if canImport(UIKit)
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
        #else
            return NSApplication.shared.windows.first ?? NSWindow()
        #endif
    }
}
