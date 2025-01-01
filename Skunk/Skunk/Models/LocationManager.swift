import CoreLocation
import Foundation
import SwiftUI

#if canImport(FirebaseAnalytics)
    import FirebaseAnalytics
#endif

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
                    if let strongSelf = self {
                        do {
                            try await strongSelf.syncLocationToCloudKit()
                            try await Task.sleep(nanoseconds: UInt64(30 * 1_000_000_000))  // 30 seconds
                        } catch {
                            print("Error in periodic sync: \(error)")
                            try? await Task.sleep(nanoseconds: UInt64(5 * 1_000_000_000))  // Wait 5 seconds before retrying
                        }
                    }
                }
            }
        }

        private func syncLocationToCloudKit() async throws {
            guard let location = currentLocation else {
                print("📍 LocationManager: No current location available")
                return
            }

            // Skip if we've updated recently, unless this is our first update
            if let lastUpdate = lastLocationUpdate {
                let timeSinceLastUpdate = Date().timeIntervalSince(lastUpdate)
                if timeSinceLastUpdate < updateInterval {
                    print(
                        "📍 LocationManager: Not enough time since last update (\(Int(timeSinceLastUpdate))s)"
                    )
                    return
                }
            } else {
                print("📍 LocationManager: First location update, syncing immediately")
            }

            print("📍 LocationManager: Starting location sync to CloudKit")
            print(
                "📍 LocationManager: Coordinates: \(location.coordinate.latitude), \(location.coordinate.longitude)"
            )
            #if canImport(FirebaseAnalytics)
                Analytics.logEvent(
                    "location_sync_started",
                    parameters: [
                        "latitude": location.coordinate.latitude,
                        "longitude": location.coordinate.longitude,
                        "accuracy": location.horizontalAccuracy,
                    ])
            #endif

            let cloudKitManager = await getCKManager()
            let userID = try await cloudKitManager.userID

            guard let userID = userID else {
                print("📍 LocationManager: Failed to get userID")
                #if canImport(FirebaseAnalytics)
                    Analytics.logEvent(
                        "location_sync_failed",
                        parameters: [
                            "reason": "no_user_id"
                        ])
                #endif
                throw NSError(
                    domain: "LocationManager", code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "Could not find current user ID"])
            }

            print("📍 LocationManager: Found userID: \(userID)")
            let currentUser = try await cloudKitManager.findPlayer(byAppleUserID: userID)
            print("📍 LocationManager: Found current user: \(currentUser.name)")

            try await cloudKitManager.updatePlayerLocation(currentUser, location: location)
            print("📍 LocationManager: Successfully updated location in CloudKit")
            #if canImport(FirebaseAnalytics)
                Analytics.logEvent(
                    "location_sync_success",
                    parameters: [
                        "user_id": userID,
                        "player_name": currentUser.name,
                    ])
            #endif
            lastLocationUpdate = Date()
        }

        private func getCKManager() async -> CloudKitManager {
            // CloudKitManager.shared is not optional and can be accessed directly
            return CloudKitManager.shared
        }

        func distanceToPlayer(_ player: Player) -> CLLocationDistance? {
            guard let currentLocation = currentLocation,
                let playerLocation = player.location,
                let lastUpdate = player.lastLocationUpdate,
                Date().timeIntervalSince(lastUpdate) < 43200  // 12 hours in seconds
            else {
                print("📍 LocationManager: Cannot calculate distance to player \(player.name)")
                if currentLocation == nil {
                    print("📍 LocationManager: No current location available")
                }
                if player.location == nil {
                    print("📍 LocationManager: Player has no location")
                }
                if let lastUpdate = player.lastLocationUpdate {
                    let timeSince = Date().timeIntervalSince(lastUpdate)
                    if timeSince >= 43200 {  // 12 hours in seconds
                        print("📍 LocationManager: Player location too old: \(Int(timeSince))s")
                    }
                } else {
                    print("📍 LocationManager: Player has no last update time")
                }
                #if canImport(FirebaseAnalytics)
                    Analytics.logEvent(
                        "distance_calculation_failed",
                        parameters: [
                            "player_name": player.name,
                            "reason": currentLocation == nil
                                ? "no_current_location"
                                : player.location == nil
                                    ? "no_player_location"
                                    : player.lastLocationUpdate == nil
                                        ? "no_last_update" : "location_too_old",
                            "time_since_update": player.lastLocationUpdate.map {
                                String(Int(Date().timeIntervalSince($0)))
                            } ?? "none",
                        ])
                #endif
                return nil
            }

            let distance = currentLocation.distance(from: playerLocation)
            print("📍 LocationManager: Distance to \(player.name): \(Int(distance))m")
            #if canImport(FirebaseAnalytics)
                Analytics.logEvent(
                    "distance_calculated",
                    parameters: [
                        "player_name": player.name,
                        "distance_meters": Int(distance),
                        "is_nearby": distance <= 30.48 ? "true" : "false",
                    ])
            #endif
            return distance
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

            // If this is our first location, set lastLocationUpdate to trigger an immediate sync
            if lastLocationUpdate == nil {
                lastLocationUpdate = Date().addingTimeInterval(-updateInterval)
            }

            // Trigger a sync when we get a new location
            Task { @MainActor in
                do {
                    try await self.syncLocationToCloudKit()
                } catch {
                    print("Error syncing location: \(error)")
                }
            }
        }
    }
#endif
