import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @StateObject private var authManager = AuthenticationManager.shared
    @Environment(\.dismiss) private var dismiss
    @State private var isSigningIn = false

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "person.crop.circle.badge.checkmark")
                .resizable()
                .scaledToFit()
                .frame(width: 100, height: 100)
                .foregroundColor(.accentColor)

            Text("Sign in to Sync Your Data")
                .font(.title2)
                .fontWeight(.bold)

            Text(
                "Sign in with your Apple ID to sync your games, matches, and players across all your devices."
            )
            .multilineTextAlignment(.center)
            .foregroundColor(.secondary)
            .padding(.horizontal)

            Spacer()

            if authManager.isSyncing {
                ProgressView("Syncing...")
                    .padding()
            }

            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.fullName, .email]
                request.requestedOperation = .operationImplicit
            } onCompletion: { result in
                Task {
                    guard !isSigningIn else { return }
                    isSigningIn = true
                    defer { isSigningIn = false }

                    switch result {
                    case .success(let authorization):
                        if let appleIDCredential = authorization.credential
                            as? ASAuthorizationAppleIDCredential
                        {
                            await authManager.handleSignInWithAppleCompletion(
                                credential: appleIDCredential)
                            dismiss()
                        }
                    case .failure(let error):
                        print("Sign in failed: \(error.localizedDescription)")
                    }
                }
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)
            .padding(.horizontal)
            .disabled(isSigningIn || authManager.isSyncing)

            Button("Cancel") {
                dismiss()
            }
            .foregroundColor(.secondary)
            .padding(.bottom)
            .disabled(isSigningIn || authManager.isSyncing)
        }
        .padding()
        .interactiveDismissDisabled(isSigningIn || authManager.isSyncing)
    }
}
