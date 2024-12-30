import CoreLocation
import Foundation
import SwiftUI

#if canImport(UIKit)
    class LocationManager: NSObject, ObservableObject {
        @Published var currentLocation: CLLocation?
        @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined

        private let locationManager = CLLocationManager()
        private var lastLocationUpdate: Date?
        private let updateInterval: TimeInterval = 30  // Update location every 30 seconds
        private var backgroundTask: Task<Void, Never>?

        override init() {
            super.init()
            locationManager.delegate = self
            locationManager.desiredAccuracy = kCLLocationAccuracyBest
            locationManager.distanceFilter = 5  // Update location when user moves 5 meters
            locationManager.allowsBackgroundLocationUpdates = false  // We only need when-in-use
            locationManager.pausesLocationUpdatesAutomatically = true
        }

        deinit {
            backgroundTask?.cancel()
        }

        func requestLocationPermission() {
            locationManager.requestWhenInUseAuthorization()
        }

        func startUpdatingLocation() {
            locationManager.startUpdatingLocation()
            startPeriodicSync()
        }

        func stopUpdatingLocation() {
            locationManager.stopUpdatingLocation()
            backgroundTask?.cancel()
            backgroundTask = nil
        }

        private func startPeriodicSync() {
            // Cancel any existing background task
            backgroundTask?.cancel()

            // Start a new background task for periodic syncing
            backgroundTask = Task { [weak self] in
                while !Task.isCancelled {
                    do {
                        if let strongSelf = self {
                            try await strongSelf.syncLocationToCloudKit()
                        }
                        try await Task.sleep(nanoseconds: UInt64(30 * 1_000_000_000))  // 30 seconds
                    } catch {
                        print("Error in periodic sync: \(error)")
                        try? await Task.sleep(nanoseconds: UInt64(5 * 1_000_000_000))  // Wait 5 seconds before retrying
                    }
                }
            }
        }

        private func syncLocationToCloudKit() async throws {
            guard let location = currentLocation,
                let lastUpdate = lastLocationUpdate,
                Date().timeIntervalSince(lastUpdate) >= updateInterval
            else {
                return
            }

            // Get the current user's player record
            let cloudKitManager = CloudKitManager.shared
            let userID = try await cloudKitManager.userID

            guard let userID = userID else {
                throw NSError(
                    domain: "LocationManager", code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "Could not find current user ID"])
            }

            // Find the current user's player
            let currentUser = try await cloudKitManager.findPlayer(byAppleUserID: userID)

            // Update the location in CloudKit
            try await cloudKitManager.updatePlayerLocation(currentUser, location: location)
            lastLocationUpdate = Date()
        }

        private func getCKManager() async throws -> CloudKitManager {
            // CloudKitManager.shared is not optional and can be accessed directly
            return CloudKitManager.shared
        }

        func distanceToPlayer(_ player: Player) -> CLLocationDistance? {
            guard let currentLocation = currentLocation,
                let playerLocation = player.location,
                // Only consider locations updated in the last 5 minutes
                let lastUpdate = player.lastLocationUpdate,
                Date().timeIntervalSince(lastUpdate) < 300
            else {
                return nil
            }
            return currentLocation.distance(from: playerLocation)
        }
    }

    extension LocationManager: CLLocationManagerDelegate {
        func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
            authorizationStatus = manager.authorizationStatus

            switch manager.authorizationStatus {
            case .authorizedWhenInUse, .authorizedAlways:
                locationManager.startUpdatingLocation()
                startPeriodicSync()
            default:
                locationManager.stopUpdatingLocation()
                backgroundTask?.cancel()
            }
        }

        func locationManager(
            _ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]
        ) {
            guard let location = locations.last else { return }
            currentLocation = location

            // Trigger a sync when we get a new location
            Task { @MainActor in
                do {
                    try await self.syncLocationToCloudKit()
                } catch {
                    print("Error syncing location: \(error)")
                }
            }
        }

        func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
            print("Location manager failed with error: \(error)")
        }
    }
#endif
