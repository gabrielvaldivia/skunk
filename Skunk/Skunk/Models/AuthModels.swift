import AuthenticationServices
import Foundation
import SwiftData

@Model
class User {
    var id: String  // Apple ID identifier
    var email: String?
    var name: String
    @Relationship(deleteRule: .cascade) var player: Player?
    var dateJoined: Date

    init(id: String, email: String?, name: String) {
        self.id = id
        self.email = email
        self.name = name
        self.dateJoined = Date()
    }
}

class AuthenticationManager: ObservableObject {
    @Published var currentUser: User?
    @Published var isAuthenticated = false

    static let shared = AuthenticationManager()
    private init() {}

    func signInWithApple() async throws {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]

        let result = try await withCheckedThrowingContinuation { continuation in
            let controller = ASAuthorizationController(authorizationRequests: [request])
            let delegate = SignInWithAppleDelegate { result in
                continuation.resume(with: result)
            }
            controller.delegate = delegate
            controller.presentationContextProvider = delegate
            controller.performRequests()
        }

        switch result {
        case .success(let authResult):
            // Handle successful sign in
            isAuthenticated = true
        // Create or fetch user will be handled in the view layer with SwiftData
        case .failure(let error):
            throw error
        }
    }

    func signOut() {
        currentUser = nil
        isAuthenticated = false
    }
}

class SignInWithAppleDelegate: NSObject, ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding
{
    private let continuation: (Result<ASAuthorization, Error>) -> Void

    init(continuation: @escaping (Result<ASAuthorization, Error>) -> Void) {
        self.continuation = continuation
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return UIApplication.shared.windows.first!
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        continuation(.success(authorization))
    }

    func authorizationController(
        controller: ASAuthorizationController, didCompleteWithError error: Error
    ) {
        continuation(.failure(error))
    }
}
