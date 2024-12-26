import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @StateObject private var authManager = AuthenticationManager.shared
    @Binding var isPresented: Bool

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

            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { result in
                Task {
                    switch result {
                    case .success(let authorization):
                        if let appleIDCredential = authorization.credential
                            as? ASAuthorizationAppleIDCredential
                        {
                            await authManager.signIn()
                            isPresented = false
                        }
                    case .failure(let error):
                        print("Sign in failed: \(error.localizedDescription)")
                    }
                }
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)
            .padding(.horizontal)

            Button("Skip for Now") {
                authManager.isAuthenticated = true
                isPresented = false
            }
            .foregroundColor(.secondary)
            .padding(.bottom)
        }
        .padding()
        .interactiveDismissDisabled(!authManager.isAuthenticated)
    }
}
