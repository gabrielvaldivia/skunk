import AuthenticationServices
import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    @MainActor
    struct SettingsView: View {
        @EnvironmentObject private var authManager: AuthenticationManager
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @Environment(\.dismiss) private var dismiss
        @State private var showingSignOut = false
        @State private var showingDeleteAccount = false
        @State private var isResettingSchema = false
        @State private var showingResetComplete = false
        @State private var showingResetError = false
        @State private var resetError: Error?

        var body: some View {
            NavigationStack {
                List {
                    Section {
                        Button(role: .destructive) {
                            showingSignOut = true
                        } label: {
                            if authManager.isSigningOut {
                                HStack {
                                    ProgressView()
                                        .controlSize(.small)
                                    Text("Signing Out...")
                                }
                            } else {
                                Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            }
                        }
                        .disabled(authManager.isSigningOut)
                    }

                    Section {
                        Button(role: .destructive) {
                            showingDeleteAccount = true
                        } label: {
                            if authManager.isDeletingAccount {
                                HStack {
                                    ProgressView()
                                        .controlSize(.small)
                                    Text("Deleting Account...")
                                }
                            } else {
                                Label(
                                    "Delete Account", systemImage: "person.crop.circle.badge.minus")
                            }
                        }
                        .disabled(authManager.isDeletingAccount)
                    } footer: {
                        Text(
                            "Deleting your account will permanently remove all your data and revoke Apple ID access."
                        )
                    }

                    Button(role: .destructive) {
                        Task {
                            isResettingSchema = true
                            do {
                                try await cloudKitManager.forceSchemaReset()
                                showingResetComplete = true
                            } catch {
                                resetError = error
                                showingResetError = true
                            }
                            isResettingSchema = false
                        }
                    } label: {
                        if isResettingSchema {
                            HStack {
                                ProgressView()
                                    .controlSize(.small)
                                Text("Resetting Schema...")
                            }
                        } else {
                            Label("Reset CloudKit Schema", systemImage: "arrow.clockwise")
                        }
                    }
                    .disabled(isResettingSchema)
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
                .alert("Schema Reset Complete", isPresented: $showingResetComplete) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(
                        "The CloudKit schema has been successfully reset. You can now try adding photos again."
                    )
                }
                .alert("Schema Reset Error", isPresented: $showingResetError) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(
                        resetError?.localizedDescription
                            ?? "An unknown error occurred while resetting the schema.")
                }
            }
        }
    }
#endif
