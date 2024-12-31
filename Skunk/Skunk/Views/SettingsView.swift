import AuthenticationServices
import CoreLocation
import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit

    @MainActor
    struct SettingsView: View {
        @EnvironmentObject private var authManager: AuthenticationManager
        @EnvironmentObject private var cloudKitManager: CloudKitManager
        @StateObject private var locationManager = LocationManager()
        @Environment(\.dismiss) private var dismiss
        @State private var showingSignOut = false
        @State private var showingDeleteAccount = false
        @State private var isResettingSchema = false
        @State private var showingResetComplete = false
        @State private var showingResetError = false
        @State private var resetError: Error?
        @State private var nearbyPlayers: [Player] = []
        @State private var refreshTask: Task<Void, Never>?

        var body: some View {
            NavigationStack {
                List {
                    Section("Location") {
                        HStack {
                            Label("Location Sharing", systemImage: "location")
                            Spacer()
                            switch locationManager.authorizationStatus {
                            case .authorizedWhenInUse, .authorizedAlways:
                                Text("On")
                                    .foregroundColor(.green)
                            case .denied, .restricted:
                                Text("Off")
                                    .foregroundColor(.red)
                            case .notDetermined:
                                Text("Not Set")
                                    .foregroundColor(.secondary)
                            @unknown default:
                                Text("Unknown")
                                    .foregroundColor(.secondary)
                            }
                        }

                        if locationManager.authorizationStatus == .denied
                            || locationManager.authorizationStatus == .restricted
                        {
                            Button {
                                if let url = URL(string: UIApplication.openSettingsURLString) {
                                    UIApplication.shared.open(url)
                                }
                            } label: {
                                Text("Open Settings to Enable Location")
                            }
                        } else if locationManager.authorizationStatus == .notDetermined {
                            Button {
                                locationManager.requestLocationPermission()
                            } label: {
                                Text("Enable Location Services")
                            }
                        }

                        if locationManager.authorizationStatus == .authorizedWhenInUse
                            || locationManager.authorizationStatus == .authorizedAlways
                        {
                            HStack {
                                Label("Nearby Players", systemImage: "person.2")
                                Spacer()
                                if let location = locationManager.currentLocation {
                                    Text("\(nearbyPlayers.count)")
                                        .foregroundColor(.secondary)
                                } else {
                                    Text("Waiting for location...")
                                        .foregroundColor(.secondary)
                                }
                            }

                            // Debug info for nearby players
                            ForEach(nearbyPlayers) { player in
                                HStack {
                                    Text(player.name)
                                    Spacer()
                                    if let distance = locationManager.distanceToPlayer(player) {
                                        Text(String(format: "%.0f meters", distance))
                                            .foregroundColor(.secondary)
                                    }
                                }
                                .font(.footnote)
                            }
                        }
                    }

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
                .onAppear {
                    print("📍 SettingsView: Starting location updates")
                    locationManager.startUpdatingLocation()
                    startPeriodicRefresh()
                }
                .onDisappear {
                    print("📍 SettingsView: Stopping location updates")
                    locationManager.stopUpdatingLocation()
                    refreshTask?.cancel()
                }
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
                .task {
                    await updateNearbyPlayers()
                }
            }
        }

        private func startPeriodicRefresh() {
            refreshTask?.cancel()
            refreshTask = Task {
                while !Task.isCancelled {
                    await updateNearbyPlayers()
                    try? await Task.sleep(nanoseconds: 5 * 1_000_000_000)  // Refresh every 5 seconds
                }
            }
        }

        private func updateNearbyPlayers() async {
            do {
                print("📍 SettingsView: Updating nearby players")
                print("📍 Current location: \(String(describing: locationManager.currentLocation))")

                let allPlayers = try await cloudKitManager.fetchPlayers()
                print("📍 Found \(allPlayers.count) total players")

                nearbyPlayers = allPlayers.filter { player in
                    // Don't include the current user in nearby players
                    guard player.appleUserID != authManager.userID else {
                        print("📍 Skipping current user: \(player.name)")
                        return false
                    }

                    guard let distance = locationManager.distanceToPlayer(player) else {
                        print("📍 No distance available for player: \(player.name)")
                        return false
                    }
                    let isNearby = distance <= 30.48  // 100 feet in meters
                    print(
                        "📍 Player \(player.name) is \(String(format: "%.1f", distance))m away (nearby: \(isNearby))"
                    )
                    return isNearby
                }
                print("📍 Found \(nearbyPlayers.count) nearby players")
            } catch {
                print("📍 Error fetching nearby players: \(error)")
            }
        }
    }
#endif
