import AuthenticationServices
import SwiftData
import SwiftUI

struct SettingsView: View {
    @StateObject private var authManager = AuthenticationManager.shared
    @Environment(\.modelContext) private var modelContext
    @State private var showingDeleteConfirmation = false
    @State private var showingSignOutConfirmation = false
    @State private var showingSignIn = false

    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    if authManager.isAuthenticated {
                        let email = UserDefaults.standard.string(forKey: "userEmail")

                        HStack {
                            Label {
                                VStack(alignment: .leading) {
                                    Text("Signed in with Apple")
                                        .font(.body)
                                    if let email = email {
                                        Text(email)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            } icon: {
                                Image(systemName: "person.crop.circle.fill")
                                    .foregroundStyle(.blue)
                            }

                            Spacer()

                            Button("Sign Out", role: .destructive) {
                                showingSignOutConfirmation = true
                            }
                        }
                    } else {
                        HStack {
                            Label {
                                Text("Signed out")
                                    .font(.body)
                            } icon: {
                                Image(systemName: "person.crop.circle.badge.xmark")
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Button("Sign In") {
                                showingSignIn = true
                            }
                            .foregroundStyle(.blue)
                        }
                    }
                }

                Section {
                    Button(role: .destructive) {
                        showingDeleteConfirmation = true
                    } label: {
                        Label("Delete All Data", systemImage: "trash")
                    }
                } footer: {
                    Text(
                        "This will permanently delete all your games, matches, and players. This action cannot be undone."
                    )
                }
            }
            .navigationTitle("Settings")
            .alert("Sign Out", isPresented: $showingSignOutConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Sign Out", role: .destructive) {
                    authManager.signOut()
                }
            } message: {
                Text(
                    "Are you sure you want to sign out? Your data will remain synced with your Apple ID."
                )
            }
            .alert("Delete All Data", isPresented: $showingDeleteConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    deleteAllData()
                }
            } message: {
                Text("Are you sure you want to delete all your data? This action cannot be undone.")
            }
            .sheet(isPresented: $showingSignIn) {
                SignInView()
            }
        }
    }

    private func deleteAllData() {
        // Delete all entities
        do {
            try modelContext.delete(model: Game.self)
            try modelContext.delete(model: Match.self)
            try modelContext.delete(model: Player.self)
            try modelContext.delete(model: Score.self)
            try modelContext.save()
        } catch {
            print("Error deleting data: \(error.localizedDescription)")
        }
    }
}
