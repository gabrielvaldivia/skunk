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
        private var groupMatchesCache: [String: [Match]] = [:]  // Cache matches by group ID
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

                    // Get the current user's record
                    let recordID = try await container.userRecordID()
                    let userRecord = try await database.record(for: recordID)

                    // Try to get the Apple user ID from the user record
                    if let appleUserID = userRecord["appleUserID"] as? String {
                        print("🟣 CloudKitManager: Found Apple user ID: \(appleUserID)")
                        return appleUserID
                    }

                    // If no Apple user ID found, we can't proceed
                    print("🟣 CloudKitManager: No Apple user ID found in user record")
                    return nil
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
                    ("supportsMultipleRounds", 0 as CKRecordValue),
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
                    ("scores", Data() as CKRecordValue),
                    ("rounds", Data() as CKRecordValue),
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
            // Check for duplicate title
            let query = CKQuery(
                recordType: "Game",
                predicate: NSPredicate(format: "title == %@ AND id != %@", game.title, game.id)
            )
            let (results, _) = try await database.records(matching: query)
            if !results.isEmpty {
                throw CloudKitError.duplicateGameTitle
            }

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

                // Force a refresh to ensure all views have the latest data
                _ = try await fetchPlayers(forceRefresh: true)

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

                // Force a refresh to ensure all views have the latest data
                _ = try await fetchPlayers(forceRefresh: true)

                print("🟣 CloudKitManager: Successfully completed player update operation")
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
            print("🟣 CloudKitManager: Fetching matches for game: \(game.id)")
            do {
                let predicate = NSPredicate(format: "gameID == %@", game.id)
                let query = CKQuery(recordType: "Match", predicate: predicate)

                let (results, _) = try await database.records(matching: query)

                print("🟣 CloudKitManager: Found \(results.count) match records")

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

            // Set up record permissions
            if let creatorID = match.createdByID {
                record["creatorReference"] = CKRecord.Reference(
                    recordID: CKRecord.ID(recordName: creatorID),
                    action: .deleteSelf
                )
            }

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

            // Only allow deletion if user is creator or participant
            if let currentUserID = await userID {
                if match.createdByID != currentUserID && !match.playerIDs.contains(currentUserID) {
                    throw CloudKitError.permissionDenied
                }
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

        enum CloudKitError: LocalizedError {
            case missingData
            case duplicateGameTitle
            case permissionDenied

            var errorDescription: String? {
                switch self {
                case .missingData:
                    return "Required data is missing"
                case .duplicateGameTitle:
                    return "A game with this title already exists"
                case .permissionDenied:
                    return "You don't have permission to perform this action"
                }
            }
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

                // Get the current user ID
                let userID = await self.userID

                // Create a predicate that includes groups created by the user
                if let userID = userID {
                    let predicate = NSPredicate(format: "createdByID == %@", userID)
                    let query = CKQuery(recordType: "PlayerGroup", predicate: predicate)
                    let (results, _) = try await database.records(matching: query)
                    let groups = results.compactMap { result -> PlayerGroup? in
                        guard let record = try? result.1.get(),
                            let group = PlayerGroup(from: record)
                        else { return nil }
                        return group
                    }

                    // Update everything at once to avoid UI flicker
                    await MainActor.run {
                        self.playerGroups = groups
                        groups.forEach { playerGroupCache[$0.id] = $0 }
                        lastPlayerGroupRefreshTime = now
                    }

                    return groups
                } else {
                    // If no user is logged in, return empty array without querying CloudKit
                    await MainActor.run {
                        self.playerGroups = []
                        playerGroupCache.removeAll()
                        lastPlayerGroupRefreshTime = now
                    }
                    return []
                }
            } catch let error as CKError {
                handleCloudKitError(error)
                throw error
            }
        }

        func savePlayerGroup(_ group: PlayerGroup) async throws {
            print("🟣 CloudKitManager: Starting to save player group: \(group.name)")
            var updatedGroup = group
            let record = group.toRecord()
            print("🟣 CloudKitManager: Created CKRecord for player group")

            do {
                let savedRecord = try await database.save(record)
                print("🟣 CloudKitManager: Successfully saved player group record to CloudKit")
                updatedGroup.recordID = savedRecord.recordID
                updatedGroup.record = savedRecord

                // Update local state
                if let index = playerGroups.firstIndex(where: { $0.id == group.id }) {
                    playerGroups[index] = updatedGroup
                } else {
                    playerGroups.append(updatedGroup)
                }
                playerGroupCache[group.id] = updatedGroup

                // Reset the last refresh time to force next fetch to get fresh data
                lastPlayerGroupRefreshTime = .distantPast

                print("🟣 CloudKitManager: Successfully completed player group save operation")
            } catch let error as CKError {
                print(
                    "🔴 CloudKitManager: CloudKit error saving player group: \(error.localizedDescription)"
                )
                print("🔴 CloudKitManager: Error code: \(error.code.rawValue)")
                throw error
            }
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
                // Update the group name if it's different from the suggested name
                if let suggestedName = suggestedName, group.name != suggestedName {
                    var updatedGroup = group
                    updatedGroup.name = suggestedName
                    try await savePlayerGroup(updatedGroup)
                    return updatedGroup
                }
                return group
            }

            // Create a new group
            let name = suggestedName ?? generateGroupName(for: sortedPlayerIDs)
            let userID = await self.userID
            let group = PlayerGroup(name: name, playerIDs: sortedPlayerIDs, createdByID: userID)

            do {
                try await savePlayerGroup(group)
                return group
            } catch let error as CKError {
                // On any CloudKit error, try to fetch the existing record
                let (results, _) = try await database.records(matching: query)
                if let result = results.first,
                    let record = try? result.1.get(),
                    let existingGroup = PlayerGroup(from: record)
                {
                    return existingGroup
                }
                throw error
            }
        }

        private func generateGroupName(for playerIDs: [String]) -> String {
            let playerNames = playerIDs.compactMap { id in
                playerCache[id]?.name
            }

            switch playerNames.count {
            case 0:
                return "No players"
            case 1:
                return playerNames[0]
            case 2:
                return "\(playerNames[0]) & \(playerNames[1])"
            default:
                let allButLast = playerNames.dropLast().joined(separator: ", ")
                return "\(allButLast), & \(playerNames.last!)"
            }
        }

        func updateAllGroupNames() async throws {
            let groups = try await fetchPlayerGroups()
            for var group in groups {
                let newName = generateGroupName(for: group.playerIDs)
                if group.name != newName {
                    group.name = newName
                    try await savePlayerGroup(group)
                }
            }
        }

        // Add a method to get matches for a group
        func getGroupMatches(_ groupId: String) -> [Match]? {
            return groupMatchesCache[groupId]
        }

        // Add a method to cache matches for a group
        func cacheGroupMatches(_ matches: [Match], for groupId: String) {
            groupMatchesCache[groupId] = matches
        }

        // Add a method to clear group matches cache
        func clearGroupMatchesCache() {
            groupMatchesCache.removeAll()
        }

        // Update loadGroupsAndMatches to return matches
        func loadGroupsAndMatches() async throws -> [String: [Match]] {
            // First ensure we have fresh player data
            _ = try await fetchPlayers(forceRefresh: true)

            // Update all group names to use the new format
            try await updateAllGroupNames()

            // Then force a fresh fetch of groups
            let groups = try await fetchPlayerGroups()

            // Load matches for each group
            var newGroupMatches: [String: [Match]] = [:]
            let games = try await fetchGames()

            // First fetch all matches for all games
            var allGameMatches: [Game: [Match]] = [:]
            for game in games {
                let gameMatches = try await fetchMatches(for: game)
                allGameMatches[game] = gameMatches
            }

            // Then process matches for each group
            for group in groups {
                var groupMatchList: [Match] = []
                for (_, matches) in allGameMatches {
                    let filteredMatches = matches.filter { match in
                        Set(match.playerIDs) == Set(group.playerIDs)
                    }
                    groupMatchList.append(contentsOf: filteredMatches)
                }
                let sortedMatches = groupMatchList.sorted { $0.date > $1.date }
                newGroupMatches[group.id] = sortedMatches
                cacheGroupMatches(sortedMatches, for: group.id)
            }

            return newGroupMatches
        }

        func updatePlayerLocation(_ player: Player, location: CLLocation) async throws {
            // First check if this is the current user's record
            let currentUserID = await userID
            guard let currentUserID = currentUserID,
                player.appleUserID == currentUserID
            else {
                print(
                    "☁️ CloudKitManager: Cannot update location - player record belongs to a different user"
                )
                return
            }

            guard let record = player.record else {
                print(
                    "☁️ CloudKitManager: Cannot update location - no record for player \(player.name)"
                )
                return
            }

            print("☁️ CloudKitManager: Updating location for player \(player.name)")
            print(
                "☁️ CloudKitManager: New coordinates: \(location.coordinate.latitude), \(location.coordinate.longitude)"
            )

            // Create a location object for CloudKit
            let location = CLLocation(
                coordinate: location.coordinate,
                altitude: location.altitude,
                horizontalAccuracy: location.horizontalAccuracy,
                verticalAccuracy: location.verticalAccuracy,
                timestamp: location.timestamp
            )

            record.setValue(location, forKey: "location")
            record.setValue(Date(), forKey: "lastLocationUpdate")

            do {
                let savedRecord = try await database.save(record)
                print("☁️ CloudKitManager: Successfully saved location to CloudKit")
                // Update cache with new record
                if let updatedPlayer = Player(from: savedRecord) {
                    print("☁️ CloudKitManager: Updated local cache for player \(updatedPlayer.name)")
                    playerCache[updatedPlayer.id] = updatedPlayer
                    if let index = players.firstIndex(where: { $0.id == updatedPlayer.id }) {
                        players[index] = updatedPlayer
                    }
                }
            } catch {
                print("☁️ CloudKitManager: Error updating player location: \(error)")
                throw error
            }
        }

        // Add a synchronous method to get current user
        func getCurrentUser(withID userID: String) -> Player? {
            return players.first(where: { $0.appleUserID == userID })
        }

        // Add a method to find player by Apple user ID
        func findPlayer(byAppleUserID appleUserID: String) async throws -> Player {
            // First try to find the player in the cache
            if let player = players.first(where: { $0.appleUserID == appleUserID }) {
                print("🟣 CloudKitManager: Found player in cache: \(player.name)")
                return player
            }

            // Try to find by Apple user ID
            let appleIDQuery = CKQuery(
                recordType: "Player",
                predicate: NSPredicate(format: "appleUserID = %@", appleUserID)
            )
            let (appleIDResults, _) = try await database.records(matching: appleIDQuery)
            if let record = try? appleIDResults.first?.1.get(),
                let player = Player(from: record)
            {
                print("🟣 CloudKitManager: Found player with Apple user ID match")
                return player
            }

            // Try to find by owner ID
            let ownerQuery = CKQuery(
                recordType: "Player",
                predicate: NSPredicate(format: "ownerID = %@", appleUserID)
            )
            let (ownerResults, _) = try await database.records(matching: ownerQuery)
            if let record = try? ownerResults.first?.1.get(),
                let player = Player(from: record)
            {
                print("🟣 CloudKitManager: Found player with owner ID match")
                // Update the player's Apple user ID for next time
                var updatedPlayer = player
                updatedPlayer.appleUserID = appleUserID
                try await savePlayer(updatedPlayer)
                return updatedPlayer
            }

            // Try to find by current user's record ID
            let recordID = try await container.userRecordID()
            let recordQuery = CKQuery(
                recordType: "Player",
                predicate: NSPredicate(format: "ownerID = %@", recordID.recordName)
            )
            let (recordResults, _) = try await database.records(matching: recordQuery)
            if let record = try? recordResults.first?.1.get(),
                let player = Player(from: record)
            {
                print("🟣 CloudKitManager: Found player with record ID match")
                // Update the player's Apple user ID for next time
                var updatedPlayer = player
                updatedPlayer.appleUserID = appleUserID
                try await savePlayer(updatedPlayer)
                return updatedPlayer
            }

            // Try to find by ID directly
            let idQuery = CKQuery(
                recordType: "Player",
                predicate: NSPredicate(format: "id = %@", appleUserID)
            )
            let (idResults, _) = try await database.records(matching: idQuery)
            if let record = try? idResults.first?.1.get(),
                let player = Player(from: record)
            {
                print("🟣 CloudKitManager: Found player with ID match")
                // Update the player's Apple user ID for next time
                var updatedPlayer = player
                updatedPlayer.appleUserID = appleUserID
                try await savePlayer(updatedPlayer)
                return updatedPlayer
            }

            throw NSError(
                domain: "CloudKitManager",
                code: -1,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "Could not find player with Apple user ID: \(appleUserID)"
                ]
            )
        }
    }
#endif
