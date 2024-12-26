import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @StateObject private var authManager = AuthenticationManager.shared
    @Environment(\.dismiss) private var dismiss

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
                    await authManager.signIn()
                    if authManager.isAuthenticated {
                        dismiss()
                    }
                }
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)
            .padding(.horizontal)

            Button("Skip for Now") {
                dismiss()
            }
            .foregroundColor(.secondary)
            .padding(.bottom)
        }
        .padding()
    }
}
