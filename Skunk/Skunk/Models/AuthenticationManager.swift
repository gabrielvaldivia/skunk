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
        @Published private(set) var isDeletingAccount = false

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
                        try? await syncPlayers()
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
            try await Task.sleep(nanoseconds: 3_000_000_000)  // 3 seconds

            userID = appleIDCredential.user
            UserDefaults.standard.set(appleIDCredential.user, forKey: "userID")

            // Handle full name
            if let fullName = appleIDCredential.fullName,
                let givenName = fullName.givenName,
                let familyName = fullName.familyName
            {
                updatePlayerName("\(givenName) \(familyName)")
            }

            // Wait for CloudKit store to be ready
            try await Task.sleep(nanoseconds: 3_000_000_000)  // 3 seconds

            // Try syncing players with retries
            for attempt in 1...3 {
                do {
                    try await Task.sleep(nanoseconds: UInt64(attempt) * 1_000_000_000)  // Increasing delay
                    try await syncPlayers()
                    break
                } catch {
                    if attempt == 3 {
                        print("❌ Failed to sync players after 3 attempts: \(error)")
                        throw error
                    }
                }
            }

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

        private func syncPlayers() async throws {
            guard let modelContext = modelContext, let userID = userID else { return }

            // Wait for store to be ready
            try await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds

            do {
                // Find current user's player
                let descriptor = FetchDescriptor<Player>(
                    predicate: #Predicate<Player> { $0.appleUserID == userID }
                )

                // Try fetching with retries
                var currentPlayers: [Player] = []
                var lastError: Error? = nil

                for attempt in 1...3 {
                    do {
                        currentPlayers = try modelContext.fetch(descriptor)
                        lastError = nil
                        break
                    } catch {
                        lastError = error
                        try await Task.sleep(nanoseconds: UInt64(attempt) * 1_000_000_000)
                        continue
                    }
                }

                if let lastError = lastError {
                    throw lastError
                }

                // Create or update current user's player
                if currentPlayers.isEmpty {
                    // Wait a bit before creating new player
                    try await Task.sleep(nanoseconds: 1_000_000_000)

                    let newPlayer = Player(name: "Player")
                    newPlayer.appleUserID = userID
                    modelContext.insert(newPlayer)

                    // Wait before saving
                    try await Task.sleep(nanoseconds: 1_000_000_000)
                    try modelContext.save()
                }
            } catch {
                print("❌ Error syncing players: \(error)")
                self.error = error
                throw error
            }
        }

        func updatePlayerName(_ name: String) {
            guard let modelContext, let userID else { return }
            do {
                let descriptor = FetchDescriptor<Player>(
                    predicate: #Predicate<Player> { player in
                        player.appleUserID == userID
                    }
                )
                let currentPlayers = try modelContext.fetch(descriptor)
                if let currentPlayer = currentPlayers.first, currentPlayer.name == nil {
                    currentPlayer.name = name
                    try modelContext.save()
                }
            } catch {
                print("❌ Error updating player name: \(error)")
                self.error = error
            }
        }

        private func resetStore() async {
            guard let modelContext = modelContext, let userID = userID, !isResettingStore else {
                return
            }

            isResettingStore = true
            do {
                // First delete all scores for matches created by this user or where this user participated
                let matchDescriptor = FetchDescriptor<Match>(
                    predicate: #Predicate<Match> { match in
                        match.createdByID == userID
                            || match.players.flatMap { players in
                                players.contains { $0.appleUserID == userID }
                            } == true
                    }
                )
                let userMatches = try modelContext.fetch(matchDescriptor)

                // Delete all scores associated with these matches
                for match in userMatches {
                    if let scores = match.scores {
                        for score in scores {
                            modelContext.delete(score)
                        }
                    }
                    // Delete the match itself
                    modelContext.delete(match)
                }

                try modelContext.save()

                // Wait for changes to be processed
                try await Task.sleep(nanoseconds: 1_000_000_000)  // 1 second

                // Delete the user's player
                let playerDescriptor = FetchDescriptor<Player>(
                    predicate: #Predicate<Player> { player in
                        player.appleUserID == userID
                    }
                )
                let userPlayers = try modelContext.fetch(playerDescriptor)
                for player in userPlayers {
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
            // First wait for any pending CloudKit operations to complete
            try? await Task.sleep(nanoseconds: 1_000_000_000)  // 1 second

            // Reset the store
            await resetStore()

            // Wait for store cleanup and CloudKit sync
            try? await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds

            // Clear credentials and state
            UserDefaults.standard.removeObject(forKey: "userID")
            userID = nil
            isAuthenticated = false

            // Final wait to ensure all operations are complete
            try? await Task.sleep(nanoseconds: 1_000_000_000)  // 1 second
        }

        func signIn() async {
            do {
                // Wait for any pending operations to complete
                try? await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds

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

                // Wait for CloudKit to initialize
                try? await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds

                try await handleSignInWithApple(authorization)

                // Final wait to ensure all operations are complete
                try? await Task.sleep(nanoseconds: 1_000_000_000)  // 1 second
            } catch {
                print("❌ Error signing in: \(error)")
                self.error = error
            }
        }

        func deleteAccount() async {
            guard let userID = userID else {
                print("❌ Error deleting account: missing userID")
                self.error = AuthenticationError.missingCredential
                return
            }
            guard let modelContext = modelContext else {
                print("❌ Error deleting account: missing modelContext")
                self.error = AuthenticationError.missingCredential
                return
            }

            isDeletingAccount = true
            defer { isDeletingAccount = false }

            do {
                // First wait for any pending CloudKit operations
                try await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds

                // First, fetch all players we need to delete
                let managedPlayerDescriptor = FetchDescriptor<Player>(
                    predicate: #Predicate<Player> { player in
                        player.ownerID == userID
                    }
                )
                let managedPlayers = try modelContext.fetch(managedPlayerDescriptor)

                // Delete all matches created by this user and their scores
                let matchDescriptor = FetchDescriptor<Match>(
                    predicate: #Predicate<Match> { match in
                        match.createdByID == userID
                    }
                )
                let userMatches = try modelContext.fetch(matchDescriptor)
                for match in userMatches {
                    // First remove all player relationships
                    if let players = match.players {
                        for player in players {
                            player.matches?.removeAll { $0.id == match.id }
                        }
                    }
                    match.players = []

                    // Then delete scores
                    if let scores = match.scores {
                        for score in scores {
                            score.player = nil
                            score.match = nil
                            modelContext.delete(score)
                        }
                    }
                    match.scores = []
                    modelContext.delete(match)
                }

                // Save and wait for CloudKit sync
                try modelContext.save()
                try await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds

                // Delete all games created by this user
                let gameDescriptor = FetchDescriptor<Game>(
                    predicate: #Predicate<Game> { game in
                        game.createdByID == userID
                    }
                )
                let userGames = try modelContext.fetch(gameDescriptor)
                for game in userGames {
                    // Delete all matches and scores associated with this game
                    if let matches = game.matches {
                        for match in matches {
                            // First remove all player relationships
                            if let players = match.players {
                                for player in players {
                                    player.matches?.removeAll { $0.id == match.id }
                                }
                            }
                            match.players = []

                            // Then delete scores
                            if let scores = match.scores {
                                for score in scores {
                                    score.player = nil
                                    score.match = nil
                                    modelContext.delete(score)
                                }
                            }
                            match.scores = []
                            modelContext.delete(match)
                        }
                    }
                    game.matches = []
                    modelContext.delete(game)
                }

                // Save and wait for CloudKit sync
                try modelContext.save()
                try await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds

                // Delete all managed players
                for player in managedPlayers {
                    // First remove all match relationships
                    if let matches = player.matches {
                        for match in matches {
                            match.players?.removeAll { $0.id == player.id }
                        }
                    }
                    player.matches = []

                    // Then delete scores
                    if let scores = player.scores {
                        for score in scores {
                            score.player = nil
                            score.match = nil
                            modelContext.delete(score)
                        }
                    }
                    player.scores = []
                    modelContext.delete(player)
                }

                // Save and wait for CloudKit sync
                try modelContext.save()
                try await Task.sleep(nanoseconds: 3_000_000_000)  // 3 seconds

                // Clear all UserDefaults related to this user
                let defaults = UserDefaults.standard
                defaults.removeObject(forKey: "userID")
                defaults.removeObject(forKey: "userDataDeleted-\(userID)")
                defaults.synchronize()

                // Clear credentials and state
                isCheckingCredentials = false  // Ensure we're not in checking state
                self.userID = nil
                isAuthenticated = false
                self.error = nil  // Clear any existing errors
                isSigningIn = false  // Reset signing in state
                isResettingStore = false  // Reset store state

                // Final wait to ensure all operations are complete
                try await Task.sleep(nanoseconds: 2_000_000_000)  // 2 seconds
            } catch {
                print("❌ Error deleting account: \(error)")
                self.error = error
                // Still reset auth state even if deletion had errors
                isCheckingCredentials = false
                self.userID = nil
                isAuthenticated = false
                isSigningIn = false
                isResettingStore = false
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
