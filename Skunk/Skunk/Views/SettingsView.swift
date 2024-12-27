import AuthenticationServices
import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    @MainActor
    struct SettingsView: View {
        @EnvironmentObject private var authManager: AuthenticationManager
        @Environment(\.dismiss) private var dismiss
        @State private var showingSignOut = false
        @State private var showingDeleteAccount = false

        var body: some View {
            NavigationStack {
                List {
                    Section {
                        Button(role: .destructive) {
                            showingSignOut = true
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    }

                    Section {
                        Button(role: .destructive) {
                            showingDeleteAccount = true
                        } label: {
                            Label("Delete Account", systemImage: "person.crop.circle.badge.minus")
                        }
                    } footer: {
                        Text(
                            "Deleting your account will permanently remove all your data and revoke Apple ID access."
                        )
                    }
                }
                .navigationTitle("Settings")
                .alert("Sign Out", isPresented: $showingSignOut) {
                    Button("Cancel", role: .cancel) {}
                    Button("Sign Out", role: .destructive) {
                        Task {
                            await authManager.signOut()
                        }
                    }
                } message: {
                    Text("Are you sure you want to sign out?")
                }
                .alert("Delete Account", isPresented: $showingDeleteAccount) {
                    Button("Cancel", role: .cancel) {}
                    Button("Delete Account", role: .destructive) {
                        Task {
                            await authManager.deleteAccount()
                        }
                    }
                } message: {
                    Text("This action cannot be undone. All your data will be permanently deleted.")
                }
            }
        }
    }
#endif
