import CloudKit
import FirebaseAnalytics
import Foundation
import SwiftUI

#if canImport(UIKit)
    @MainActor
    class CloudKitManager: ObservableObject {
        static let shared = CloudKitManager()
        private let container: CKContainer
        private let database: CKDatabase
        private var lastRefreshTime: Date = .distantPast
        private var lastGamesRefreshTime: Date = .distantPast
        private var isRefreshing = false
        private var matchCache: [String: [Match]] = [:]  // Cache matches by game ID
        private var playerMatchesCache: [String: [Match]] = [:]  // Cache matches by player ID
        private var playerCache: [String: Player] = [:]  // Cache players by ID
        private var refreshDebounceTask: Task<Void, Never>?
        private let debounceInterval: TimeInterval = 2.0  // 2 seconds debounce
        private let cacheTimeout: TimeInterval = 30.0  // 30 seconds cache timeout
        private var lastPlayerRefreshTime: Date = .distantPast
        private var isRefreshingPlayers = false
        private var playerRefreshDebounceTask: Task<Void, Never>?
        private let playerRefreshDebounceInterval: TimeInterval = 2.0  // 2 seconds debounce

        @Published var games: [Game] = []
        @Published private(set) var players: [Player] = []  // Make players private(set)
        @Published var isLoading = false
        @Published var error: Error?

        init() {
            self.container = CKContainer(identifier: "iCloud.com.gvaldivia.skunkapp")
            self.database = container.publicCloudDatabase
        }

        // MARK: - Schema Setup

        func setupSchema() async throws {
            do {
                print("🟣 CloudKitManager: Starting schema setup")

                // Define the schema fields
                let gameFields = [
                    "title",
                    "isBinaryScore",
                    "supportedPlayerCounts",
                    "createdByID",
                    "id",
                ]

                let playerFields = [
                    "name",
                    "colorData",
                    "appleUserID",
                    "ownerID",
                    "id",
                    "photo",
                ]

                let matchFields = [
                    "date",
                    "playerIDs",
                    "playerOrder",
                    "winnerID",
                    "isMultiplayer",
                    "status",
                    "invitedPlayerIDs",
                    "acceptedPlayerIDs",
                    "lastModified",
                    "createdByID",
                    "gameID",
                    "id",
                ]

                print("🟣 CloudKitManager: Saving schema definitions")

                // Save the schema definitions
                let zone = CKRecordZone(zoneName: "Schema")
                try await database.modifyRecordZones(saving: [zone], deleting: [])

                // Create sample records to establish schema
                let gameRecord = CKRecord(recordType: "Game")
                let playerRecord = CKRecord(recordType: "Player")
                let matchRecord = CKRecord(recordType: "Match")

                // Set default values to establish field types
                for field in gameFields {
                    gameRecord[field] = ""  // Set appropriate default values based on field type
                }

                for field in playerFields {
                    playerRecord[field] = ""  // Set appropriate default values based on field type
                }

                for field in matchFields {
                    matchRecord[field] = ""  // Set appropriate default values based on field type
                }

                // Save the sample records to establish schema
                try await database.save(gameRecord)
                try await database.save(playerRecord)
                try await database.save(matchRecord)

                print("🟣 CloudKitManager: Schema setup complete")

                // Clear local caches
                matchCache.removeAll()
                playerCache.removeAll()
                players.removeAll()
                games.removeAll()

            } catch {
                print("🟣 CloudKitManager: Schema setup error: \(error.localizedDescription)")
                if let ckError = error as? CKError {
                    print("🔴 CloudKitManager: CloudKit error code: \(ckError.code.rawValue)")
                }
                throw error
            }
        }

        // MARK: - Games

        func fetchGames() async throws -> [Game] {
            // Return cached games if they're fresh enough
            let now = Date()
            if !games.isEmpty && now.timeIntervalSince(lastGamesRefreshTime) < cacheTimeout {
                return games
            }

            do {
                let query = CKQuery(
                    recordType: "Game", predicate: NSPredicate(format: "title != ''"))
                let (results, _) = try await database.records(matching: query)
                let games = results.compactMap { result -> Game? in
                    guard let record = try? result.1.get() else { return nil }
                    return Game(from: record)
                }
                self.games = games
                lastGamesRefreshTime = now
                return games
            } catch let error as CKError {
                handleCloudKitError(error)
                throw error
            }
        }

        func saveGame(_ game: Game) async throws {
            var updatedGame = game
            let record = game.toRecord()
            let savedRecord = try await database.save(record)
            updatedGame.recordID = savedRecord.recordID
            updatedGame.record = savedRecord

            if let index = games.firstIndex(where: { $0.id == game.id }) {
                games[index] = updatedGame
            } else {
                games.append(updatedGame)
            }

            Analytics.logEvent(
                "game_saved",
                parameters: [
                    "game_id": game.id,
                    "game_title": game.title,
                    "is_binary_score": game.isBinaryScore,
                    "supported_player_counts": game.supportedPlayerCounts.map(String.init).joined(
                        separator: ","),
                ])
        }

        func deleteGame(_ game: Game) async throws {
            guard let recordID = game.recordID else {
                throw CloudKitError.missingData
            }
            try await database.deleteRecord(withID: recordID)
            games.removeAll { $0.id == game.id }

            Analytics.logEvent(
                "game_deleted",
                parameters: [
                    "game_id": game.id,
                    "game_title": game.title,
                ])
        }

        // MARK: - Players

        func fetchPlayers(forceRefresh: Bool = false) async throws -> [Player] {
            // Return cached players if we have them and they're fresh enough
            let now = Date()
            if !forceRefresh && !players.isEmpty
                && now.timeIntervalSince(lastPlayerRefreshTime) < cacheTimeout
            {
                print("🟣 CloudKitManager: Returning cached players")
                return players
            }

            // If already refreshing, wait for the current refresh to complete
            if isRefreshingPlayers {
                print("🟣 CloudKitManager: Already refreshing players, waiting...")
                return players
            }

            // Cancel any pending debounce task
            playerRefreshDebounceTask?.cancel()

            // Create a new debounce task
            return await withCheckedContinuation { continuation in
                playerRefreshDebounceTask = Task {
                    do {
                        isRefreshingPlayers = true
                        print("🟣 CloudKitManager: Fetching players from CloudKit...")
                        let query = CKQuery(
                            recordType: "Player", predicate: NSPredicate(format: "name != ''"))
                        let (results, _) = try await database.records(matching: query)
                        print("🟣 CloudKitManager: Found \(results.count) player records")

                        var newPlayers: [Player] = []
                        for result in results {
                            guard let record = try? result.1.get(),
                                let player = Player(from: record)
                            else { continue }
                            updatePlayerCache(player)
                            newPlayers.append(player)
                        }

                        // Remove players that no longer exist
                        let newPlayerIds = Set(newPlayers.map { $0.id })
                        let removedPlayerIds = Set(playerCache.keys).subtracting(newPlayerIds)
                        for id in removedPlayerIds {
                            removePlayerFromCache(id)
                        }

                        lastPlayerRefreshTime = now
                        isRefreshingPlayers = false
                        continuation.resume(returning: players)
                    } catch {
                        print(
                            "🟣 CloudKitManager: Error fetching players: \(error.localizedDescription)"
                        )
                        isRefreshingPlayers = false
                        continuation.resume(returning: players)
                    }
                }
            }
        }

        func refreshPlayers() async throws {
            _ = try await fetchPlayers(forceRefresh: true)
        }

        func getOrCreatePlayer(name: String, appleUserID: String?) async throws -> Player {
            print(
                "🟣 CloudKitManager: Getting or creating player with name: \(name), appleUserID: \(appleUserID ?? "nil")"
            )

            // First, try to find an existing player
            if let appleUserID = appleUserID {
                if let existingPlayer = players.first(where: { $0.appleUserID == appleUserID }) {
                    print(
                        "🟣 CloudKitManager: Found existing player by Apple User ID: \(existingPlayer.name)"
                    )
                    return existingPlayer
                }
            }

            // Then try by name
            if let existingPlayer = players.first(where: { $0.name == name }) {
                print("🟣 CloudKitManager: Found existing player by name: \(existingPlayer.name)")
                return existingPlayer
            }

            // If no existing player found, create a new one
            print("🟣 CloudKitManager: Creating new player: \(name)")
            let newPlayer = Player(name: name, appleUserID: appleUserID)
            try await savePlayer(newPlayer)
            return newPlayer
        }

        func fetchCurrentUserPlayer(userID: String) async throws -> Player? {
            do {
                print("🟣 CloudKitManager: Fetching current user player for ID: \(userID)")

                // Create a query that specifically looks for the user's ID
                let predicate = NSPredicate(format: "appleUserID == %@", userID)
                let query = CKQuery(recordType: "Player", predicate: predicate)
                let (results, _) = try await database.records(matching: query)

                // Get the first matching player
                for result in results {
                    guard let record = try? result.1.get(),
                        let player = Player(from: record)
                    else { continue }

                    print("🟣 CloudKitManager: Found current user player: \(player.name)")
                    return player
                }

                print("🟣 CloudKitManager: No player found for user ID: \(userID)")
                return nil
            } catch let error as CKError {
                print(
                    "🔴 CloudKitManager: Error fetching current user player: \(error.localizedDescription)"
                )
                print("🔴 CloudKitManager: Error code: \(error.code.rawValue)")
                handleCloudKitError(error)
                throw error
            }
        }

        func savePlayer(_ player: Player) async throws {
            print(
                "🟣 CloudKitManager: Starting to save player with name: \(player.name), appleUserID: \(player.appleUserID ?? "nil")"
            )
            var updatedPlayer = player
            let record = player.toRecord()
            print("🟣 CloudKitManager: Created CKRecord for player")

            do {
                let savedRecord = try await database.save(record)
                print("🟣 CloudKitManager: Successfully saved player record to CloudKit")
                updatedPlayer.recordID = savedRecord.recordID
                updatedPlayer.record = savedRecord

                // Update both the cache and published array
                updatePlayerCache(updatedPlayer)

                // Reset the last refresh time to force next fetch to get fresh data
                lastPlayerRefreshTime = .distantPast

                // Notify of changes
                objectWillChange.send()
                print("🟣 CloudKitManager: Successfully completed player save operation")

                Analytics.logEvent(
                    "player_saved",
                    parameters: [
                        "player_id": player.id,
                        "player_name": player.name,
                        "has_apple_id": String(player.appleUserID != nil),
                        "has_photo": String(player.photoData != nil),
                    ])
            } catch let error as CKError {
                print(
                    "🔴 CloudKitManager: CloudKit error saving player: \(error.localizedDescription)"
                )
                print("🔴 CloudKitManager: Error code: \(error.code.rawValue)")
                Analytics.logEvent(
                    "player_save_error",
                    parameters: [
                        "error_code": String(error.code.rawValue),
                        "error_description": error.localizedDescription,
                        "player_name": player.name,
                    ])
                if let serverRecord = error.serverRecord {
                    print("🔴 CloudKitManager: Server record exists: \(serverRecord)")
                }
                if let retryAfter = error.retryAfterSeconds {
                    print("🔴 CloudKitManager: Retry suggested after \(retryAfter) seconds")
                }
                throw error
            } catch {
                print(
                    "🔴 CloudKitManager: Non-CloudKit error saving player: \(error.localizedDescription)"
                )
                Analytics.logEvent(
                    "player_save_error",
                    parameters: [
                        "error_type": "non_cloudkit",
                        "error_description": error.localizedDescription,
                        "player_name": player.name,
                    ])
                throw error
            }
        }

        func updatePlayer(_ player: Player) async throws {
            print("🟣 CloudKitManager: Updating player: \(player.name)")
            print("🟣 CloudKitManager: Photo data size: \(player.photoData?.count ?? 0) bytes")

            do {
                guard let recordID = player.recordID else {
                    print("🟣 CloudKitManager: No record found, creating new player")
                    try await savePlayer(player)
                    return
                }

                // Fetch the latest record from CloudKit
                print("🟣 CloudKitManager: Fetching latest record")
                let latestRecord = try await database.record(for: recordID)

                // Update the fetched record with new values
                latestRecord.setValue(player.id, forKey: "id")
                latestRecord.setValue(player.name, forKey: "name")
                latestRecord.setValue(player.colorData, forKey: "colorData")
                latestRecord.setValue(player.appleUserID, forKey: "appleUserID")
                latestRecord.setValue(player.ownerID, forKey: "ownerID")

                // Handle photo data as CKAsset
                if let photoData = player.photoData {
                    print("🟣 CloudKitManager: Creating photo asset")
                    let tempDir = FileManager.default.temporaryDirectory
                    let fileName = UUID().uuidString + ".jpg"
                    let fileURL = tempDir.appendingPathComponent(fileName)

                    do {
                        try photoData.write(to: fileURL)
                        let asset = CKAsset(fileURL: fileURL)
                        latestRecord.setValue(asset, forKey: "photo")
                        print("🟣 CloudKitManager: Successfully created photo asset")
                    } catch {
                        print("🟣 CloudKitManager: Error creating photo asset: \(error)")
                        Analytics.logEvent(
                            "player_photo_error",
                            parameters: [
                                "error_description": error.localizedDescription,
                                "player_name": player.name,
                            ])
                    }
                } else {
                    latestRecord.setValue(nil, forKey: "photo")
                }

                print("🟣 CloudKitManager: Saving updated player record")
                let savedRecord = try await database.save(latestRecord)
                print("🟣 CloudKitManager: Successfully saved player record")

                // Create an updated player with the saved record
                var updatedPlayer = player
                updatedPlayer.record = savedRecord
                updatedPlayer.recordID = savedRecord.recordID

                // Update both the cache and published array
                updatePlayerCache(updatedPlayer)

                // Reset the last refresh time to force next fetch to get fresh data
                lastPlayerRefreshTime = .distantPast

                // Notify of changes
                objectWillChange.send()

                Analytics.logEvent(
                    "player_updated",
                    parameters: [
                        "player_id": player.id,
                        "player_name": player.name,
                        "has_photo": String(player.photoData != nil),
                    ])

                print("🟣 CloudKitManager: Starting force refresh")
                // Force a refresh to ensure all views have the latest data
                _ = try await fetchPlayers(forceRefresh: true)
                print("🟣 CloudKitManager: Completed force refresh")
            } catch let error as CKError {
                print(
                    "🟣 CloudKitManager: CloudKit error during update: \(error.localizedDescription)"
                )
                print("🟣 CloudKitManager: Error code: \(error.code.rawValue)")
                Analytics.logEvent(
                    "player_update_error",
                    parameters: [
                        "error_code": String(error.code.rawValue),
                        "error_description": error.localizedDescription,
                        "player_name": player.name,
                    ])
                handleCloudKitError(error)
                throw error
            } catch {
                print(
                    "🟣 CloudKitManager: Non-CloudKit error during update: \(error.localizedDescription)"
                )
                Analytics.logEvent(
                    "player_update_error",
                    parameters: [
                        "error_type": "non_cloudkit",
                        "error_description": error.localizedDescription,
                        "player_name": player.name,
                    ])
                throw error
            }
        }

        func deletePlayer(_ player: Player) async throws {
            guard let recordID = player.recordID else {
                throw CloudKitError.missingData
            }
            try await database.deleteRecord(withID: recordID)
            players.removeAll { $0.id == player.id }

            Analytics.logEvent(
                "player_deleted",
                parameters: [
                    "player_id": player.id,
                    "player_name": player.name,
                ])
        }

        func fetchPlayer(id: String) async throws -> Player? {
            do {
                let predicate = NSPredicate(format: "id == %@", id)
                let query = CKQuery(recordType: "Player", predicate: predicate)
                let (results, _) = try await database.records(matching: query)

                if let result = results.first,
                    let record = try? result.1.get(),
                    let player = Player(from: record)
                {
                    // Update the local cache without triggering a refresh
                    if let index = players.firstIndex(where: { $0.id == player.id }) {
                        players[index] = player
                    } else {
                        players.append(player)
                    }
                    return player
                }
                return nil
            } catch let error as CKError {
                handleCloudKitError(error)
                throw error
            }
        }

        // MARK: - Matches

        func fetchMatches(for game: Game) async throws -> [Match] {
            // Return cached matches if available
            if let cachedMatches = matchCache[game.id] {
                return cachedMatches
            }

            do {
                print("🟣 CloudKitManager: Fetching matches for game: \(game.id)")
                let query = CKQuery(
                    recordType: "Match", predicate: NSPredicate(format: "gameID == %@", game.id))
                query.sortDescriptors = [NSSortDescriptor(key: "date", ascending: false)]

                let (results, _) = try await database.records(matching: query)
                print("🟣 CloudKitManager: Found \(results.count) match records in CloudKit")

                let matches = results.compactMap { result -> Match? in
                    guard let record = try? result.1.get() else {
                        print("🟣 CloudKitManager: Failed to get match record")
                        return nil
                    }
                    print(
                        "🟣 CloudKitManager: Processing match record: \(record.recordID.recordName)")
                    var match = Match(from: record)
                    match?.game = game
                    return match
                }
                print("🟣 CloudKitManager: Successfully parsed \(matches.count) matches")

                // Update cache
                matchCache[game.id] = matches

                // Update game's matches without triggering a refresh
                if let index = games.firstIndex(where: { $0.id == game.id }) {
                    games[index].matches = matches
                }

                return matches
            } catch let error as CKError {
                handleCloudKitError(error)
                throw error
            }
        }

        func saveMatch(_ match: Match) async throws {
            print("🟣 CloudKitManager: Saving match with ID: \(match.id)")
            var updatedMatch = match
            let record = match.toRecord()
            let savedRecord = try await database.save(record)
            updatedMatch.recordID = savedRecord.recordID
            updatedMatch.record = savedRecord

            // Update cache and game's matches
            if let gameId = match.game?.id {
                var matches = matchCache[gameId] ?? []
                if let index = matches.firstIndex(where: { $0.id == match.id }) {
                    matches[index] = updatedMatch
                } else {
                    matches.append(updatedMatch)
                }
                matchCache[gameId] = matches

                // Update game's matches without triggering a refresh
                if let gameIndex = games.firstIndex(where: { $0.id == gameId }) {
                    games[gameIndex].matches = matches
                }
            }

            Analytics.logEvent(
                "match_saved",
                parameters: [
                    "match_id": match.id,
                    "game_id": match.game?.id ?? "",
                    "game_title": match.game?.title ?? "",
                    "player_count": String(match.playerIDs.count),
                    "is_multiplayer": String(match.isMultiplayer),
                    "status": match.status,
                ])
        }

        func deleteMatch(_ match: Match) async throws {
            guard let recordID = match.recordID else {
                throw CloudKitError.missingData
            }
            try await database.deleteRecord(withID: recordID)

            // Update cache and game's matches
            if let gameId = match.game?.id {
                matchCache[gameId]?.removeAll { $0.id == match.id }
                if let gameIndex = games.firstIndex(where: { $0.id == gameId }) {
                    games[gameIndex].matches = matchCache[gameId]
                }
            }

            Analytics.logEvent(
                "match_deleted",
                parameters: [
                    "match_id": match.id,
                    "game_id": match.game?.id ?? "",
                    "game_title": match.game?.title ?? "",
                ])
        }

        // MARK: - Subscriptions

        func setupSubscriptions() async throws {
            try await setupGameSubscription()
            try await setupPlayerSubscription()
            try await setupMatchSubscription()
        }

        private func setupGameSubscription() async throws {
            let predicate = NSPredicate(value: true)
            let subscription = CKQuerySubscription(
                recordType: "Game",
                predicate: predicate,
                subscriptionID: "all-games",
                options: [.firesOnRecordCreation, .firesOnRecordDeletion, .firesOnRecordUpdate]
            )

            let notificationInfo = CKSubscription.NotificationInfo()
            notificationInfo.shouldSendContentAvailable = true
            subscription.notificationInfo = notificationInfo

            try await database.save(subscription)
        }

        private func setupPlayerSubscription() async throws {
            let predicate = NSPredicate(value: true)
            let subscription = CKQuerySubscription(
                recordType: "Player",
                predicate: predicate,
                subscriptionID: "all-players",
                options: [.firesOnRecordCreation, .firesOnRecordDeletion, .firesOnRecordUpdate]
            )

            let notificationInfo = CKSubscription.NotificationInfo()
            notificationInfo.shouldSendContentAvailable = true
            subscription.notificationInfo = notificationInfo

            try await database.save(subscription)
        }

        private func setupMatchSubscription() async throws {
            let predicate = NSPredicate(value: true)
            let subscription = CKQuerySubscription(
                recordType: "Match",
                predicate: predicate,
                subscriptionID: "all-matches",
                options: [.firesOnRecordCreation, .firesOnRecordDeletion, .firesOnRecordUpdate]
            )

            let notificationInfo = CKSubscription.NotificationInfo()
            notificationInfo.shouldSendContentAvailable = true
            subscription.notificationInfo = notificationInfo

            try await database.save(subscription)
        }

        private func handleCloudKitError(_ error: Error) {
            print("CloudKit error: \(error.localizedDescription)")
            if let ckError = error as? CKError {
                print("Error code: \(ckError.code.rawValue)")
                print("Error description: \(ckError.localizedDescription)")

                Analytics.logEvent(
                    "cloudkit_error",
                    parameters: [
                        "error_code": String(ckError.code.rawValue),
                        "error_description": ckError.localizedDescription,
                        "error_type": String(describing: type(of: error)),
                    ])
            }
        }

        // MARK: - Error Handling

        enum CloudKitError: Error {
            case missingData
        }

        func deleteAllPlayers() async throws {
            try await withThrowingTaskGroup(of: Void.self) { group in
                for player in players {
                    group.addTask {
                        try await self.deletePlayer(player)
                    }
                }
                try await group.waitForAll()
            }
            players.removeAll()
        }

        func deletePlayersWithoutAppleID() async throws {
            // Only delete players that have no Apple ID AND are not owned by anyone
            let playersToDelete = players.filter { player in
                player.appleUserID == nil && player.ownerID == nil
            }
            try await withThrowingTaskGroup(of: Void.self) { group in
                for player in playersToDelete {
                    group.addTask {
                        try await self.deletePlayer(player)
                    }
                }
                try await group.waitForAll()
            }
            players.removeAll { player in
                player.appleUserID == nil && player.ownerID == nil
            }
        }

        // Add a method to handle specific record changes
        func handleRecordChange(_ record: CKRecord) async {
            switch record.recordType {
            case "Player":
                if let id = record.value(forKey: "id") as? String,
                    let player = Player(from: record)
                {
                    // Update cache directly with the record we already have
                    updatePlayerCache(player)
                }
            case "Game":
                _ = try? await fetchGames()
            case "Match":
                matchCache.removeAll()
                clearPlayerMatchesCache()  // Clear player matches cache when any match changes
            default:
                break
            }
        }

        func handleSubscriptionNotification(for recordType: String, recordID: CKRecord.ID? = nil) {
            // Cancel any existing debounce task
            refreshDebounceTask?.cancel()

            // Create a new debounce task
            refreshDebounceTask = Task { [weak self] in
                do {
                    try await Task.sleep(for: .seconds(self?.debounceInterval ?? 2.0))
                    guard !Task.isCancelled else { return }

                    switch recordType {
                    case "Player":
                        if let recordID = recordID {
                            // Fetch just this one record directly
                            let record = try? await self?.database.record(for: recordID)
                            if let record = record,
                                let player = Player(from: record)
                            {
                                self?.updatePlayerCache(player)
                            }
                        } else {
                            _ = try? await self?.fetchPlayers()
                        }
                    case "Game":
                        _ = try? await self?.fetchGames()
                    case "Match":
                        // Only clear the specific match from cache if we have its ID
                        if let recordID = recordID,
                            let gameID = self?.matchCache.first(where: {
                                $0.value.contains { $0.recordID == recordID }
                            })?.key
                        {
                            self?.matchCache.removeValue(forKey: gameID)
                        }
                    default:
                        break
                    }
                } catch {}
            }
        }

        // Add methods to access players
        func getPlayer(id: String) -> Player? {
            return playerCache[id]
        }

        func getPlayers() -> [Player] {
            return players
        }

        private func updatePlayerCache(_ player: Player) {
            playerCache[player.id] = player
            if let index = players.firstIndex(where: { $0.id == player.id }) {
                players[index] = player
            } else {
                players.append(player)
            }
        }

        private func removePlayerFromCache(_ playerId: String) {
            playerCache.removeValue(forKey: playerId)
            players.removeAll { $0.id == playerId }
        }

        func forceSchemaReset() async throws {
            print("🟣 CloudKitManager: Starting schema reset")

            do {
                // Set up the schema
                try await setupSchema()

                // Set up subscriptions
                try await setupSubscriptions()

                // Clear local caches
                matchCache.removeAll()
                playerCache.removeAll()
                players.removeAll()
                games.removeAll()

                print("🟣 CloudKitManager: Schema reset complete")
            } catch {
                print("🔴 CloudKitManager: Schema reset error: \(error.localizedDescription)")
                if let ckError = error as? CKError {
                    print("🔴 CloudKitManager: CloudKit error code: \(ckError.code.rawValue)")
                }
                throw error
            }
        }

        // Add a method to get matches for a player
        func getPlayerMatches(_ playerId: String) -> [Match]? {
            return playerMatchesCache[playerId]
        }

        // Add a method to cache matches for a player
        func cachePlayerMatches(_ matches: [Match], for playerId: String) {
            playerMatchesCache[playerId] = matches
        }

        // Add a method to clear player matches cache
        func clearPlayerMatchesCache() {
            playerMatchesCache.removeAll()
        }
    }
#endif
