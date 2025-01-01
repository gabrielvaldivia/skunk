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

        // New enum for cache types
        private enum CacheType: Hashable {
            case game(String)  // gameId
            case player(String)  // playerId
            case group(String)  // groupId
        }

        // Unified cache structure
        private var matchCache: [CacheType: [Match]] = [:]
        private var playerCache: [String: Player] = [:]  // Keep this separate as it's a different type

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
        private let adminUserID = "000697.08cebe0a4edc475ca4a09155face4314.0206"  // Admin user ID

        @Published var games: [Game] = []
        @Published private(set) var players: [Player] = []  // Make players private(set)
        @Published private(set) var playerGroups: [PlayerGroup] = []
        @Published var isLoading = false
        @Published var error: Error?
        @Published var isCloudAvailable: Bool = false

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
            container = CKContainer(identifier: "iCloud.com.gvaldivia.skunkapp")
            database = container.publicCloudDatabase
            print(
                "🟣 CloudKitManager: Initializing with container identifier: \(container.containerIdentifier ?? "unknown")"
            )

            // Verify container configuration immediately
            Task {
                do {
                    // First check if the container exists
                    let containerExists = try await CKContainer.default().containerIdentifier != nil
                    print("🟣 CloudKitManager: Default container exists: \(containerExists)")

                    // Then check account status
                    let accountStatus = try await container.accountStatus()
                    print("🟣 CloudKitManager: Account status: \(accountStatus.rawValue)")

                    switch accountStatus {
                    case .available:
                        print("🟣 CloudKitManager: iCloud account is available")
                        do {
                            let userRecordID = try await container.userRecordID()
                            print(
                                "🟣 CloudKitManager: Successfully got user record ID: \(userRecordID.recordName)"
                            )

                            // Try to create user record in private database if it doesn't exist
                            do {
                                let privateRecord = try await container.privateCloudDatabase.record(
                                    for: userRecordID)
                                print("🟣 CloudKitManager: User record exists in private database")
                            } catch {
                                print("🟣 CloudKitManager: Creating user record in private database")
                                let userRecord = CKRecord(
                                    recordType: "User", recordID: userRecordID)
                                _ = try await container.privateCloudDatabase.save(userRecord)
                            }

                            // Set up schema with new field
                            try await setupSchema()

                        } catch {
                            print(
                                "🔴 CloudKitManager: Error getting user record ID: \(error.localizedDescription)"
                            )
                        }
                    case .noAccount:
                        print(
                            "🔴 CloudKitManager: No iCloud account found - please sign in to iCloud")
                    case .restricted:
                        print("🔴 CloudKitManager: iCloud account is restricted")
                    case .couldNotDetermine:
                        print("🔴 CloudKitManager: Could not determine iCloud account status")
                    @unknown default:
                        print("🔴 CloudKitManager: Unknown iCloud account status: \(accountStatus)")
                    }
                } catch {
                    print(
                        "🔴 CloudKitManager: Error during initialization: \(error.localizedDescription)"
                    )
                    if let ckError = error as? CKError {
                        print("🔴 CloudKitManager: CKError code: \(ckError.code.rawValue)")
                        handleCloudKitError(ckError)
                    }
                }
            }
        }

        func verifyContainerSetup() async throws {
            print("🟣 CloudKitManager: Verifying container setup")

            // Check account status
            let accountStatus = try await container.accountStatus()
            print("🟣 CloudKitManager: Account status: \(accountStatus)")

            guard accountStatus == .available else {
                print("🔴 CloudKitManager: No iCloud account available")
                throw CloudKitError.notAuthenticated
            }

            // Try to fetch user record ID to verify container access
            do {
                let userRecordID = try await container.userRecordID()
                print(
                    "🟣 CloudKitManager: Successfully fetched user record ID: \(userRecordID.recordName)"
                )

                // Try to access the database
                do {
                    let userRecord = try await database.record(for: userRecordID)
                    print("🟣 CloudKitManager: Successfully verified database access")
                } catch let error as CKError where error.code == .unknownItem {
                    // This is actually okay - it means the user record doesn't exist yet
                    print("🟣 CloudKitManager: No user record yet, but container access verified")
                }

            } catch let error as CKError {
                print(
                    "🔴 CloudKitManager: CloudKit error during verification: \(error.localizedDescription)"
                )
                print("🔴 CloudKitManager: Error code: \(error.code.rawValue)")

                if error.code == .badContainer {
                    print("🔴 CloudKitManager: Container is not properly configured")
                    throw CloudKitError.containerNotConfigured
                } else {
                    throw error
                }
            }

            print("🟣 CloudKitManager: Container setup verification complete")
        }

        // MARK: - Schema Setup

        struct CloudKitBackup {
            var games: [(CKRecord, Game)]
            var players: [(CKRecord, Player)]
            var matches: [(CKRecord, Match)]
        }

        func backupData() async throws -> CloudKitBackup {
            print("🟣 CloudKitManager: Starting data backup")

            var backup = CloudKitBackup(games: [], players: [], matches: [])

            // Backup games
            let gameQuery = CKQuery(recordType: "Game", predicate: NSPredicate(value: true))
            let (gameResults, _) = try await database.records(matching: gameQuery)
            for result in gameResults {
                if let record = try? result.1.get(),
                    let game = try? Game(from: record)
                {
                    backup.games.append((record, game))
                }
            }
            print("🟣 CloudKitManager: Backed up \(backup.games.count) games")

            // Backup players
            let playerQuery = CKQuery(recordType: "Player", predicate: NSPredicate(value: true))
            let (playerResults, _) = try await database.records(matching: playerQuery)
            for result in playerResults {
                if let record = try? result.1.get(),
                    let player = Player(from: record)
                {
                    backup.players.append((record, player))
                }
            }
            print("🟣 CloudKitManager: Backed up \(backup.players.count) players")

            // Backup matches
            let matchQuery = CKQuery(recordType: "Match", predicate: NSPredicate(value: true))
            let (matchResults, _) = try await database.records(matching: matchQuery)
            for result in matchResults {
                if let record = try? result.1.get(),
                    let match = Match(from: record)
                {
                    backup.matches.append((record, match))
                }
            }
            print("🟣 CloudKitManager: Backed up \(backup.matches.count) matches")

            return backup
        }

        func restoreBackup(_ backup: CloudKitBackup) async throws {
            print("🟣 CloudKitManager: Starting data restoration")

            // Restore players first (since games and matches depend on them)
            for (record, _) in backup.players {
                try await database.save(record)
            }
            print("🟣 CloudKitManager: Restored \(backup.players.count) players")

            // Restore games
            for (record, _) in backup.games {
                try await database.save(record)
            }
            print("🟣 CloudKitManager: Restored \(backup.games.count) games")

            // Restore matches
            for (record, _) in backup.matches {
                try await database.save(record)
            }
            print("🟣 CloudKitManager: Restored \(backup.matches.count) matches")

            // Refresh local caches
            _ = try await fetchPlayers(forceRefresh: true)
            _ = try await fetchGames(forceRefresh: true)

            print("🟣 CloudKitManager: Data restoration complete")
        }

        func resetSchema() async throws {
            print("🟣 CloudKitManager: Starting schema reset")

            // Create backup first
            let backup = try await backupData()
            print(
                "🟣 CloudKitManager: Created backup of \(backup.games.count) games, \(backup.players.count) players, and \(backup.matches.count) matches"
            )

            // Delete existing records
            let gameQuery = CKQuery(recordType: "Game", predicate: NSPredicate(value: true))
            let playerQuery = CKQuery(recordType: "Player", predicate: NSPredicate(value: true))
            let matchQuery = CKQuery(recordType: "Match", predicate: NSPredicate(value: true))

            do {
                // Delete all game records
                let (gameResults, _) = try await database.records(matching: gameQuery)
                for result in gameResults {
                    if let record = try? result.1.get() {
                        try await database.deleteRecord(withID: record.recordID)
                    }
                }

                // Delete all player records
                let (playerResults, _) = try await database.records(matching: playerQuery)
                for result in playerResults {
                    if let record = try? result.1.get() {
                        try await database.deleteRecord(withID: record.recordID)
                    }
                }

                // Delete all match records
                let (matchResults, _) = try await database.records(matching: matchQuery)
                for result in matchResults {
                    if let record = try? result.1.get() {
                        try await database.deleteRecord(withID: record.recordID)
                    }
                }

                print("🟣 CloudKitManager: Successfully deleted existing records")
            } catch {
                print("🔴 CloudKitManager: Error deleting records: \(error.localizedDescription)")
            }

            // Clear local caches
            matchCache.removeAll()
            playerCache.removeAll()
            players.removeAll()
            games.removeAll()

            print("🟣 CloudKitManager: Schema reset complete")

            // After schema is reset and new field is added, restore the backup
            try await restoreBackup(backup)
        }

        func updateSchema() async throws {
            print("🟣 CloudKitManager: Starting schema update")

            // Get all existing game records
            let gameQuery = CKQuery(recordType: "Game", predicate: NSPredicate(value: true))
            let (gameResults, _) = try await database.records(matching: gameQuery)

            // Update each game record with the new field
            for result in gameResults {
                if let record = try? result.1.get() {
                    // Only add the field if it doesn't exist
                    if record["highestRoundScoreWins"] == nil {
                        record["highestRoundScoreWins"] = 1 as CKRecordValue  // Default to true
                        try await database.save(record)
                        print(
                            "🟣 CloudKitManager: Updated game record with new field: \(record.recordID.recordName)"
                        )
                    }
                }
            }

            // Create a sample record to establish the schema if no records exist
            if gameResults.isEmpty {
                print("🟣 CloudKitManager: No existing games, creating sample record")
                let zone = CKRecordZone(zoneName: "_defaultZone")
                let gameRecord = CKRecord(recordType: "Game", zoneID: zone.zoneID)

                // Set all required fields
                gameRecord["title"] = "" as CKRecordValue
                gameRecord["isBinaryScore"] = 0 as CKRecordValue
                gameRecord["supportedPlayerCounts"] = Data() as CKRecordValue
                gameRecord["createdByID"] = "" as CKRecordValue
                gameRecord["id"] = "" as CKRecordValue
                gameRecord["countAllScores"] = 0 as CKRecordValue
                gameRecord["countLosersOnly"] = 0 as CKRecordValue
                gameRecord["highestScoreWins"] = 0 as CKRecordValue
                gameRecord["highestRoundScoreWins"] = 1 as CKRecordValue
                gameRecord["winningConditions"] = "game:high|round:high" as CKRecordValue

                try await database.save(gameRecord)
                print("🟣 CloudKitManager: Created sample record to establish schema")
            }

            print("🟣 CloudKitManager: Schema update complete")
        }

        func setupSchema() async throws {
            do {
                print("🟣 CloudKitManager: Starting schema setup")

                // First verify the container setup
                try await verifyContainerSetup()

                // Update the schema instead of resetting it
                try await updateSchema()

                print("🟣 CloudKitManager: Schema setup complete")
            } catch {
                print("🔴 CloudKitManager: Schema setup error: \(error.localizedDescription)")
                if let ckError = error as? CKError {
                    print("🔴 CloudKitManager: CloudKit error code: \(ckError.code.rawValue)")
                    handleCloudKitError(ckError)
                }
                throw error
            }
        }

        // MARK: - Games

        func fetchGames(forceRefresh: Bool = false) async throws -> [Game] {
            print("🟣 CloudKitManager: Starting to fetch games")
            let now = Date()

            // If we recently fetched and it's not a force refresh, return cached
            if !forceRefresh && now.timeIntervalSince(lastGamesRefreshTime) < cacheTimeout {
                print("🟣 CloudKitManager: Returning cached games (count: \(games.count))")
                return games
            }

            do {
                print("🟣 CloudKitManager: Querying CloudKit for games")
                let query = CKQuery(
                    recordType: "Game",
                    predicate: NSPredicate(format: "title != ''")
                )
                query.sortDescriptors = [NSSortDescriptor(key: "title", ascending: true)]

                let (results, _) = try await database.records(matching: query)
                print("🟣 CloudKitManager: Found \(results.count) game records")

                var newGames: [Game] = []
                for result in results {
                    guard let record = try? result.1.get() else {
                        print("🔴 CloudKitManager: Failed to get record from result")
                        continue
                    }

                    // Try to create game from record
                    if let game = Game(from: record) {
                        print("🟣 CloudKitManager: Successfully parsed game: \(game.title)")
                        newGames.append(game)
                    } else {
                        print("🔴 CloudKitManager: Failed to create Game from record")
                    }
                }

                print("🟣 CloudKitManager: Successfully parsed \(newGames.count) games")

                // If this is a force refresh, clear all caches first
                if forceRefresh {
                    print("🟣 CloudKitManager: Force refresh - clearing all caches")
                    matchCache.removeAll()
                    lastGamesRefreshTime = .distantPast
                    lastPlayerRefreshTime = .distantPast
                    lastPlayerGroupRefreshTime = .distantPast
                }

                await MainActor.run {
                    self.games = newGames
                }
                lastGamesRefreshTime = now
                return newGames

            } catch let error as CKError {
                print("🔴 CloudKitManager: Error fetching games: \(error.localizedDescription)")
                print("🔴 CloudKitManager: Error code: \(error.code.rawValue)")
                handleCloudKitError(error)
                throw error
            }
        }

        func saveGame(_ game: Game) async throws {
            try await ensureCloudKitAccess()

            do {
                var record: CKRecord
                if let recordID = game.recordID {
                    // Fetch existing record to update
                    let existingRecord = try await database.record(for: recordID)
                    // Update existing record with new values
                    existingRecord["id"] = game.id
                    existingRecord["title"] = game.title
                    existingRecord["isBinaryScore"] = game.isBinaryScore ? 1 : 0
                    existingRecord["countAllScores"] = game.countAllScores ? 1 : 0
                    existingRecord["countLosersOnly"] = game.countLosersOnly ? 1 : 0
                    existingRecord["highestScoreWins"] = game.highestScoreWins ? 1 : 0
                    existingRecord["highestRoundScoreWins"] = game.highestRoundScoreWins ? 1 : 0
                    if let countsData = try? JSONEncoder().encode(Array(game.supportedPlayerCounts))
                    {
                        existingRecord["supportedPlayerCounts"] = countsData
                    }
                    existingRecord["createdByID"] = game.createdByID
                    record = existingRecord
                } else {
                    // Create new record
                    record = game.toRecord()
                }

                let savedRecord = try await database.save(record)
                guard let updatedGame = try Game(from: savedRecord) else {
                    throw CloudKitError.recordConversionFailed
                }

                await MainActor.run {
                    // Update local cache
                    if let index = games.firstIndex(where: { $0.id == game.id }) {
                        games[index] = updatedGame
                    } else {
                        games.append(updatedGame)
                    }

                    // Sort games by title
                    games.sort {
                        $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
                    }
                }

                // Reset refresh time to ensure next fetch gets latest data
                lastGamesRefreshTime = .distantPast

            } catch let error as CKError {
                print(
                    "🔴 CloudKitManager: CloudKit error saving game: \(error.localizedDescription)")
                print("🔴 CloudKitManager: Error code: \(error.code.rawValue)")
                handleCloudKitError(error)
                throw error
            }
        }

        func deleteGame(_ game: Game) async throws {
            print("🟣 CloudKitManager: Starting to delete game: \(game.id)")
            try await ensureCloudKitAccess()

            guard let currentUserID = await userID else {
                print("🔴 CloudKitManager: No user ID found")
                throw CloudKitError.notAuthenticated
            }

            if isAdmin(currentUserID) || game.createdByID == currentUserID {
                print("🟣 CloudKitManager: User has permission to delete game")
                do {
                    // For existing games, try to update permissions first
                    if let recordID = game.recordID {
                        do {
                            // Fetch the current record
                            let record = try await database.record(for: recordID)

                            // Update permissions
                            if let creatorID = game.createdByID {
                                record["creatorReference"] = CKRecord.Reference(
                                    recordID: CKRecord.ID(recordName: creatorID),
                                    action: .none
                                )
                                // Save the updated record
                                try await database.save(record)
                            }

                            // Now try to delete it
                            try await database.deleteRecord(withID: recordID)
                        } catch {
                            print(
                                "🔴 CloudKitManager: Error updating game permissions: \(error.localizedDescription)"
                            )
                            // Try deleting with a new record ID as fallback
                            let gameRecordID = CKRecord.ID(recordName: game.id)
                            try await database.deleteRecord(withID: gameRecordID)
                        }
                    } else {
                        // Fallback to using the game ID
                        let gameRecordID = CKRecord.ID(recordName: game.id)
                        try await database.deleteRecord(withID: gameRecordID)
                    }

                    // Update local state
                    await MainActor.run {
                        games.removeAll { $0.id == game.id }
                        matchCache.removeValue(forKey: .game(game.id))
                    }

                    // Reset refresh time to ensure next fetch gets latest data
                    lastGamesRefreshTime = .distantPast

                    print("🟣 CloudKitManager: Game deletion completed successfully")

                } catch let error as CKError {
                    print("🔴 CloudKitManager: Error deleting game: \(error.localizedDescription)")
                    print("🔴 CloudKitManager: Error code: \(error.code.rawValue)")

                    // If the record doesn't exist, consider it a success
                    if error.code == .unknownItem {
                        print("🟣 CloudKitManager: Record already deleted")
                        await MainActor.run {
                            games.removeAll { $0.id == game.id }
                            matchCache.removeValue(forKey: .game(game.id))
                        }
                        return
                    }

                    handleCloudKitError(error)
                    throw error
                }
            } else {
                print("🔴 CloudKitManager: User does not have permission to delete game")
                throw CloudKitError.permissionDenied
            }
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
            print("🟣 CloudKitManager: Starting to save player with name: \(player.name)")

            // First ensure we have CloudKit access
            try await ensureCloudKitAccess()

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
                handleCloudKitError(error)
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
                matchCache[.game(game.id)] = matches

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
                var matches = matchCache[.game(gameId)] ?? []
                if let index = matches.firstIndex(where: { $0.id == match.id }) {
                    matches[index] = updatedMatch
                } else {
                    matches.append(updatedMatch)
                }
                matchCache[.game(gameId)] = matches

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
                matchCache[.game(gameId)]?.removeAll { $0.id == match.id }
                if let gameIndex = games.firstIndex(where: { $0.id == gameId }) {
                    games[gameIndex].matches = matchCache[.game(gameId)]
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
                if let retryAfter = ckError.retryAfterSeconds {
                    print("Retry after: \(retryAfter) seconds")
                }
                if let serverRecord = ckError.serverRecord {
                    print("Server record: \(serverRecord)")
                }
            }
        }

        // MARK: - Error Handling

        enum CloudKitError: LocalizedError {
            case missingData
            case duplicateGameTitle
            case permissionDenied
            case notAuthenticated
            case containerNotConfigured
            case recordConversionFailed

            var errorDescription: String? {
                switch self {
                case .missingData:
                    return "Required data is missing"
                case .duplicateGameTitle:
                    return "A game with this title already exists"
                case .permissionDenied:
                    return "You don't have permission to perform this action"
                case .notAuthenticated:
                    return "No iCloud account is configured. Please sign in to iCloud in Settings"
                case .containerNotConfigured:
                    return "CloudKit container is not properly configured"
                case .recordConversionFailed:
                    return "Failed to convert CloudKit record to game data"
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

        // Add a method to get matches for a player
        func getPlayerMatches(_ playerId: String) -> [Match]? {
            return matchCache[.player(playerId)]
        }

        // Add a method to cache matches for a player
        func cachePlayerMatches(_ matches: [Match], for playerId: String) {
            matchCache[.player(playerId)] = matches
        }

        // Add a method to clear player matches cache
        func clearPlayerMatchesCache() {
            matchCache = matchCache.filter { key, _ in
                if case .player = key { return false }
                return true
            }
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

            do {
                let record: CKRecord
                if let existingRecordID = group.recordID {
                    // Update existing group
                    print("🟣 CloudKitManager: Updating existing player group")
                    record = try await database.record(for: existingRecordID)
                    // Update record fields
                    record["name"] = group.name as CKRecordValue
                    record["playerIDs"] = try JSONEncoder().encode(group.playerIDs) as CKRecordValue
                    record["createdByID"] =
                        group.createdByID as? CKRecordValue ?? "" as CKRecordValue
                    record["id"] = group.id as CKRecordValue
                } else {
                    // Create new group
                    print("🟣 CloudKitManager: Creating new player group")
                    record = group.toRecord()
                }

                let savedRecord = try await database.save(record)
                print("🟣 CloudKitManager: Successfully saved player group record")
                updatedGroup.recordID = savedRecord.recordID
                updatedGroup.record = savedRecord

                await MainActor.run {
                    // Update local cache
                    if let index = playerGroups.firstIndex(where: { $0.id == group.id }) {
                        playerGroups[index] = updatedGroup
                    } else {
                        playerGroups.append(updatedGroup)
                    }
                    playerGroupCache[group.id] = updatedGroup

                    // Notify observers of the change
                    objectWillChange.send()
                }

                // Reset refresh time
                lastPlayerGroupRefreshTime = .distantPast

                print("🟣 CloudKitManager: Successfully completed player group save operation")
            } catch let error as CKError {
                print(
                    "🔴 CloudKitManager: CloudKit error saving player group: \(error.localizedDescription)"
                )
                print("🔴 CloudKitManager: Error code: \(error.code.rawValue)")
                handleCloudKitError(error)
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
            return matchCache[.group(groupId)]
        }

        // Add a method to cache matches for a group
        func cacheGroupMatches(_ matches: [Match], for groupId: String) {
            matchCache[.group(groupId)] = matches
        }

        // Add a method to clear group matches cache
        func clearGroupMatchesCache() {
            matchCache = matchCache.filter { key, _ in
                if case .group = key { return false }
                return true
            }
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

        func checkCloudKitAvailability() async throws -> Bool {
            do {
                let accountStatus = try await container.accountStatus()
                print("🟣 CloudKitManager: Raw account status value: \(accountStatus.rawValue)")

                // Check if the container identifier is accessible
                if let containerId = try? await CKContainer.default().containerIdentifier {
                    print("🟣 CloudKitManager: Default container ID: \(containerId)")
                } else {
                    print("🔴 CloudKitManager: No default container identifier available")
                }

                // Check if we can access the current container
                if let currentContainerId = container.containerIdentifier {
                    print("🟣 CloudKitManager: Current container ID: \(currentContainerId)")
                } else {
                    print("🔴 CloudKitManager: No container identifier available")
                }

                await MainActor.run {
                    self.isCloudAvailable = accountStatus == .available
                }

                switch accountStatus {
                case .available:
                    print("🟣 CloudKitManager: iCloud is available")
                    return true
                case .noAccount:
                    print("🔴 CloudKitManager: No iCloud account")
                    throw CloudKitError.notAuthenticated
                case .restricted:
                    print("🔴 CloudKitManager: iCloud is restricted")
                    throw CloudKitError.notAuthenticated
                case .couldNotDetermine:
                    print("🔴 CloudKitManager: Could not determine iCloud status")
                    throw CloudKitError.notAuthenticated
                @unknown default:
                    print("🔴 CloudKitManager: Unknown iCloud status: \(accountStatus.rawValue)")
                    throw CloudKitError.notAuthenticated
                }
            } catch {
                print(
                    "🔴 CloudKitManager: Error checking iCloud status: \(error.localizedDescription)"
                )
                await MainActor.run {
                    self.isCloudAvailable = false
                }
                throw error
            }
        }

        func ensureCloudKitAccess() async throws {
            guard try await checkCloudKitAvailability() else {
                throw CloudKitError.notAuthenticated
            }

            // Try to get user record ID to verify access
            do {
                let userRecordID = try await container.userRecordID()
                print(
                    "🟣 CloudKitManager: Verified CloudKit access with user ID: \(userRecordID.recordName)"
                )
            } catch {
                print(
                    "🔴 CloudKitManager: Failed to verify CloudKit access: \(error.localizedDescription)"
                )
                throw error
            }
        }

        func isAdmin(_ userID: String) -> Bool {
            return userID == adminUserID
        }

        func fetchRecentMatches(forGame gameId: String, limit: Int) async throws -> [Match] {
            try await ensureCloudKitAccess()

            let predicate = NSPredicate(format: "gameID == %@", gameId)
            let sort = NSSortDescriptor(key: "date", ascending: false)
            let query = CKQuery(recordType: "Match", predicate: predicate)
            query.sortDescriptors = [sort]

            let (results, _) = try await database.records(
                matching: query,
                resultsLimit: limit
            )

            let matches = try results.compactMap { result -> Match? in
                guard let record = try? result.1.get() else { return nil }
                return try? Match(from: record)
            }

            return matches
        }

        func fetchRecentMatches(forPlayer playerId: String, limit: Int) async throws -> [Match] {
            try await ensureCloudKitAccess()

            let predicate = NSPredicate(format: "playerIDs CONTAINS %@", playerId)
            let sort = NSSortDescriptor(key: "date", ascending: false)
            let query = CKQuery(recordType: "Match", predicate: predicate)
            query.sortDescriptors = [sort]

            let (results, _) = try await database.records(
                matching: query,
                resultsLimit: limit
            )

            let matches = try results.compactMap { result -> Match? in
                guard let record = try? result.1.get() else { return nil }
                return try? Match(from: record)
            }

            return matches
        }

        func fetchRecentMatches(forGroup groupId: String, limit: Int) async throws -> [Match] {
            try await ensureCloudKitAccess()

            // Get the player IDs for this group
            let groupRecordID = CKRecord.ID(recordName: groupId)
            let groupRecord = try await database.record(for: groupRecordID)
            guard let groupData = groupRecord["playerIDs"] as? Data,
                let playerIDs = try? JSONDecoder().decode([String].self, from: groupData)
            else {
                return []
            }

            // Create a predicate that matches matches containing ALL players in the group
            var format = "playerIDs CONTAINS %@"
            var args: [String] = [playerIDs[0]]

            for id in playerIDs.dropFirst() {
                format += " AND playerIDs CONTAINS %@"
                args.append(id)
            }

            let predicate = NSPredicate(format: format, argumentArray: args)
            let sort = NSSortDescriptor(key: "date", ascending: false)
            let query = CKQuery(recordType: "Match", predicate: predicate)
            query.sortDescriptors = [sort]

            let (results, _) = try await database.records(
                matching: query,
                resultsLimit: limit
            )

            let matches = try results.compactMap { result -> Match? in
                guard let record = try? result.1.get() else { return nil }
                return try? Match(from: record)
            }

            return matches
        }

        // MARK: - Match Cache Methods

        func getMatchesForGame(_ gameId: String) -> [Match]? {
            return matchCache[.game(gameId)]
        }

        func cacheMatchesForGame(_ matches: [Match], gameId: String) {
            matchCache[.game(gameId)] = matches
        }

        func getMatchesForPlayer(_ playerId: String) -> [Match]? {
            return matchCache[.player(playerId)]
        }

        func cacheMatchesForPlayer(_ matches: [Match], playerId: String) {
            matchCache[.player(playerId)] = matches
        }

        func getMatchesForGroup(_ groupId: String) -> [Match]? {
            return matchCache[.group(groupId)]
        }

        func cacheMatchesForGroup(_ matches: [Match], groupId: String) {
            matchCache[.group(groupId)] = matches
        }

        // MARK: - Activity Methods

        func fetchRecentActivityMatches(limit: Int, daysBack: Int = 3) async throws -> [Match] {
            try await ensureCloudKitAccess()

            let calendar = Calendar.current
            let startDate = calendar.date(byAdding: .day, value: -daysBack, to: Date()) ?? Date()

            let predicate = NSPredicate(format: "date >= %@", startDate as NSDate)
            let sort = NSSortDescriptor(key: "date", ascending: false)
            let query = CKQuery(recordType: "Match", predicate: predicate)
            query.sortDescriptors = [sort]

            let (results, _) = try await database.records(
                matching: query,
                resultsLimit: limit
            )

            let matches = try results.compactMap { result -> Match? in
                guard let record = try? result.1.get() else { return nil }
                var match = try? Match(from: record)

                // Attach game to match
                if let gameId = record["gameID"] as? String,
                    let game = games.first(where: { $0.id == gameId })
                {
                    match?.game = game
                }

                return match
            }

            return matches.sorted { $0.date > $1.date }
        }
    }
#endif
