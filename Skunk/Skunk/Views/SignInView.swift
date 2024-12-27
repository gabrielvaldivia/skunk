import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var authManager: AuthenticationManager
    @State private var showError = false
    @State private var errorMessage = ""

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "dice.fill")
                .font(.system(size: 60))
                .foregroundStyle(.tint)

            Text("Welcome to Skunk")
                .font(.title)
                .fontWeight(.bold)

            Text("Sign in to play with friends")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if authManager.isCheckingCredentials {
                ProgressView("Checking credentials...")
            } else {
                SignInWithAppleButton { request in
                    request.requestedScopes = [.fullName]
                } onCompletion: { result in
                    switch result {
                    case .success(let authorization):
                        Task {
                            do {
                                try await authManager.handleSignInWithApple(authorization)
                            } catch {
                                showError = true
                                errorMessage = error.localizedDescription
                            }
                        }
                    case .failure(let error):
                        showError = true
                        errorMessage = error.localizedDescription
                    }
                }
                .signInWithAppleButtonStyle(.black)
                .frame(height: 45)
                .padding(.horizontal, 40)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.background)
        .alert("Sign In Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
    }
}
