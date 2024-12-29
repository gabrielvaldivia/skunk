import CloudKit
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
        private let refreshInterval: TimeInterval = 30.0  // 30 seconds refresh interval
        private var lastPlayerRefreshTime: Date = .distantPast
        private var isRefreshingPlayers = false
        private var playerRefreshDebounceTask: Task<Void, Never>?
        private let playerRefreshDebounceInterval: TimeInterval = 2.0  // 2 seconds debounce
        private var playerGroupCache: [String: PlayerGroup] = [:]
        private var lastPlayerGroupRefreshTime: Date = .distantPast

        @Published var games: [Game] = []
        @Published private(set) var players: [Player] = []  // Make players private(set)
        @Published private(set) var playerGroups: [PlayerGroup] = []
        @Published var isLoading = false
        @Published var error: Error?

        var userID: String? {
            get async {
                do {
                    let accountStatus = try await container.accountStatus()
                    guard accountStatus == .available else { return nil }

                    // Get the user record ID directly
                    let recordID = try await container.userRecordID()
                    return recordID.recordName
                } catch {
                    print("Error getting user ID: \(error)")
                    return nil
                }
            }
        }

        init() {
            self.container = CKContainer(identifier: "iCloud.com.gvaldivia.skunkapp")
            self.database = container.publicCloudDatabase
        }

        // MARK: - Schema Setup

        func setupSchema() async throws {
            do {
                print("🟣 CloudKitManager: Starting schema setup")

                // Define the schema fields with their types
                let gameFields: [(String, CKRecordValue)] = [
                    ("title", "" as CKRecordValue),
                    ("isBinaryScore", 0 as CKRecordValue),  // Changed to number
                    ("supportedPlayerCounts", Data() as CKRecordValue),
                    ("createdByID", "" as CKRecordValue),
                    ("id", "" as CKRecordValue),
                ]

                let playerFields: [(String, CKRecordValue)] = [
                    ("name", "" as CKRecordValue),
                    ("colorData", Data() as CKRecordValue),
                    ("appleUserID", "" as CKRecordValue),
                    ("ownerID", "" as CKRecordValue),
                    ("id", "" as CKRecordValue),
                ]

                let matchFields: [(String, CKRecordValue)] = [
                    ("date", Date() as CKRecordValue),
                    ("playerIDs", Data() as CKRecordValue),
                    ("playerOrder", Data() as CKRecordValue),
                    ("winnerID", "" as CKRecordValue),
                    ("isMultiplayer", 0 as CKRecordValue),
                    ("status", "" as CKRecordValue),
                    ("invitedPlayerIDs", Data() as CKRecordValue),
                    ("acceptedPlayerIDs", Data() as CKRecordValue),
                    ("lastModified", Date() as CKRecordValue),
                    ("createdByID", "" as CKRecordValue),
                    ("gameID", "" as CKRecordValue),
                    ("id", "" as CKRecordValue),
                ]

                let playerGroupFields: [(String, CKRecordValue)] = [
                    ("name", "" as CKRecordValue),
                    ("playerIDs", Data() as CKRecordValue),
                    ("createdByID", "" as CKRecordValue),
                    ("id", "" as CKRecordValue),
                ]

                print("🟣 CloudKitManager: Saving schema definitions")

                // Create a temporary file for the photo asset
                let tempDir = FileManager.default.temporaryDirectory
                let tempFile = tempDir.appendingPathComponent("temp.jpg")
                let emptyData = Data()
                try emptyData.write(to: tempFile)
                let photoAsset = CKAsset(fileURL: tempFile)

                // Save the schema definitions
                let zone = CKRecordZone(zoneName: "Schema")
                try await database.modifyRecordZones(saving: [zone], deleting: [])

                // Create sample records to establish schema
                let gameRecord = CKRecord(recordType: "Game")
                let playerRecord = CKRecord(recordType: "Player")
                let matchRecord = CKRecord(recordType: "Match")
                let playerGroupRecord = CKRecord(recordType: "PlayerGroup")

                // Set field values with correct types
                for (field, value) in gameFields {
                    gameRecord[field] = value
                }

                for (field, value) in playerFields {
                    playerRecord[field] = value
                }
                // Set photo asset separately
                playerRecord["photo"] = photoAsset

                for (field, value) in matchFields {
                    matchRecord[field] = value
                }

                for (field, value) in playerGroupFields {
                    playerGroupRecord[field] = value
                }

                // Save the sample records to establish schema
                try await database.save(gameRecord)
                try await database.save(playerRecord)
                try await database.save(matchRecord)
                try await database.save(playerGroupRecord)

                // Clean up temporary file
                try? FileManager.default.removeItem(at: tempFile)

                print("🟣 CloudKitManager: Schema setup complete")

                // Clear local caches
                matchCache.removeAll()
                playerCache.removeAll()
                players.removeAll()
                games.removeAll()
                playerGroups.removeAll()
                playerGroupCache.removeAll()

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
        }

        func deleteGame(_ game: Game) async throws {
            guard let recordID = game.recordID else {
                throw CloudKitError.missingData
            }
            try await database.deleteRecord(withID: recordID)
            games.removeAll { $0.id == game.id }
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
            } catch let error as CKError {
                print(
                    "🔴 CloudKitManager: CloudKit error saving player: \(error.localizedDescription)"
                )
                print("🔴 CloudKitManager: Error code: \(error.code.rawValue)")
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

                print("🟣 CloudKitManager: Starting force refresh")
                // Force a refresh to ensure all views have the latest data
                _ = try await fetchPlayers(forceRefresh: true)
                print("🟣 CloudKitManager: Completed force refresh")
            } catch let error as CKError {
                print(
                    "🟣 CloudKitManager: CloudKit error during update: \(error.localizedDescription)"
                )
                print("🟣 CloudKitManager: Error code: \(error.code.rawValue)")
                handleCloudKitError(error)
                throw error
            } catch {
                print(
                    "🟣 CloudKitManager: Non-CloudKit error during update: \(error.localizedDescription)"
                )
                throw error
            }
        }

        func deletePlayer(_ player: Player) async throws {
            guard let recordID = player.recordID else {
                throw CloudKitError.missingData
            }
            try await database.deleteRecord(withID: recordID)
            players.removeAll { $0.id == player.id }
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
        }

        // MARK: - Subscriptions

        func setupSubscriptions() async throws {
            try await setupGameSubscription()
            try await setupPlayerSubscription()
            try await setupMatchSubscription()
            try await setupPlayerGroupSubscription()
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

        private func setupPlayerGroupSubscription() async throws {
            let subscription = CKQuerySubscription(
                recordType: "PlayerGroup",
                predicate: NSPredicate(value: true),
                subscriptionID: "player-group-changes",
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

        // MARK: - Player Groups

        func fetchPlayerGroups() async throws -> [PlayerGroup] {
            let now = Date()
            if now.timeIntervalSince(lastPlayerGroupRefreshTime) < refreshInterval {
                return playerGroups
            }

            await MainActor.run { isLoading = true }
            defer { Task { @MainActor in isLoading = false } }

            do {
                // First ensure we have the latest player data
                _ = try await fetchPlayers(forceRefresh: true)

                // Fetch all matches to find unique player combinations
                let games = try await fetchGames()
                var uniquePlayerCombinations = Set<String>()

                for game in games {
                    let matches = try await fetchMatches(for: game)
                    for match in matches {
                        let sortedIDs = match.playerIDs.sorted()
                        // Only add combinations where we have all player data
                        if sortedIDs.allSatisfy({ playerCache[$0] != nil }) {
                            let idString = sortedIDs.joined(separator: ",")
                            uniquePlayerCombinations.insert(idString)
                        }
                    }
                }

                // Create or fetch groups for each unique combination
                var groups: [PlayerGroup] = []
                for idString in uniquePlayerCombinations {
                    let playerIDs = idString.split(separator: ",").map(String.init)
                    let group = try await findOrCreatePlayerGroup(for: playerIDs)
                    groups.append(group)
                }

                // Update everything at once to avoid UI flicker
                await MainActor.run {
                    self.playerGroups = groups
                    groups.forEach { playerGroupCache[$0.id] = $0 }
                    lastPlayerGroupRefreshTime = now
                }

                return groups
            } catch let error as CKError {
                handleCloudKitError(error)
                throw error
            }
        }

        func savePlayerGroup(_ group: PlayerGroup) async throws {
            var updatedGroup = group
            let record = group.toRecord()
            let savedRecord = try await database.save(record)
            updatedGroup.recordID = savedRecord.recordID
            updatedGroup.record = savedRecord

            if let index = playerGroups.firstIndex(where: { $0.id == group.id }) {
                playerGroups[index] = updatedGroup
            } else {
                playerGroups.append(updatedGroup)
            }
            playerGroupCache[group.id] = updatedGroup
        }

        func deletePlayerGroup(_ group: PlayerGroup) async throws {
            guard let recordID = group.recordID else {
                throw CloudKitError.missingData
            }
            try await database.deleteRecord(withID: recordID)
            playerGroups.removeAll { $0.id == group.id }
            playerGroupCache.removeValue(forKey: group.id)
        }

        func findOrCreatePlayerGroup(for playerIDs: [String], suggestedName: String? = nil)
            async throws -> PlayerGroup
        {
            let sortedPlayerIDs = playerIDs.sorted()

            // First check if we have an existing group with these exact players
            let playerIDsData = try JSONEncoder().encode(sortedPlayerIDs)
            let predicate = NSPredicate(format: "playerIDs == %@", playerIDsData as CVarArg)
            let query = CKQuery(recordType: "PlayerGroup", predicate: predicate)
            let (results, _) = try await database.records(matching: query)

            if let result = results.first,
                let record = try? result.1.get(),
                let group = PlayerGroup(from: record)
            {
                return group
            }

            // Create a new group
            let name = suggestedName ?? generateGroupName(for: sortedPlayerIDs)
            let userID = await self.userID
            let group = PlayerGroup(name: name, playerIDs: sortedPlayerIDs, createdByID: userID)
            try await savePlayerGroup(group)
            return group
        }

        private func generateGroupName(for playerIDs: [String]) -> String {
            let playerNames = playerIDs.compactMap { id in
                playerCache[id]?.name
            }
            return playerNames.joined(separator: ", ")
        }
    }
#endif
