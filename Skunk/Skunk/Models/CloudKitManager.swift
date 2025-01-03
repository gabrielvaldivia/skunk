import CloudKit
import Foundation
import SwiftUI

#if canImport(UIKit)
    struct User: Identifiable {
        let id: String
        let lastLogin: Date
        var recordID: CKRecord.ID?

        init?(from record: CKRecord) {
            guard let id = record["id"] as? String else { return nil }
            self.id = id
            self.lastLogin = record["lastLogin"] as? Date ?? Date()
            self.recordID = record.recordID
        }
    }

    @MainActor
    class CloudKitManager: ObservableObject {
        static let shared = CloudKitManager()
        private let container: CKContainer
        private var database: CKDatabase
        private var lastRefreshTime: Date = .distantPast
        private var lastGamesRefreshTime: Date = .distantPast
        private var isRefreshing = false
        private var isInitialized = false
        private var initializationTask: Task<Void, Never>?
        private lazy var matchCache: [String: [Match]] = [:]  // Cache matches by game ID
        private lazy var playerMatchesCache: [String: [Match]] = [:]  // Cache matches by player ID
        private lazy var groupMatchesCache: [String: [Match]] = [:]  // Cache matches by group ID
        private lazy var playerCache: [String: Player] = [:]  // Cache players by ID
        private var refreshDebounceTask: Task<Void, Never>?
        private let debounceInterval: TimeInterval = 2.0  // 2 seconds debounce
        private let cacheTimeout: TimeInterval = 30.0  // 30 seconds cache timeout
        private let refreshInterval: TimeInterval = 30.0  // 30 seconds refresh interval
        private var lastPlayerRefreshTime: Date = .distantPast
        private var isRefreshingPlayers = false
        private var playerRefreshDebounceTask: Task<Void, Never>?
        private let playerRefreshDebounceInterval: TimeInterval = 2.0  // 2 seconds debounce
        private lazy var playerGroupCache: [String: PlayerGroup] = [:]
        private var lastPlayerGroupRefreshTime: Date = .distantPast
        private let adminUserID = "_a14224e45b63646ed996a87dc9da2edc"  // Admin user ID

        @Published var games: [Game] = []
        @Published private(set) var players: [Player] = []  // Make players private(set)
        @Published private(set) var playerGroups: [PlayerGroup] = []
        @Published var isLoading = false
        @Published var error: Error?
        @Published var isCloudAvailable: Bool = false
        @Published private(set) var currentUser: User?

        var userID: String? {
            get async {
                do {
                    let accountStatus = try await container.accountStatus()
                    guard accountStatus == .available else { return nil }

                    // Get the current user's record ID
                    let recordID = try await container.userRecordID()
                    return recordID.recordName
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
            print("🟣 CloudKitManager: Using public database")

            // Defer container verification to a background task
            initializationTask = Task { @MainActor in
                await initializeInBackground()
            }
        }

        private func initializeInBackground() async {
            guard !isInitialized else { return }

            do {
                // First check if the container exists
                let containerExists = try await CKContainer.default().containerIdentifier != nil
                print("🟣 CloudKitManager: Default container exists: \(containerExists)")

                // Then check account status
                let accountStatus = try await container.accountStatus()
                print("🟣 CloudKitManager: Account status: \(accountStatus.rawValue)")

                if accountStatus == .available {
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
                            let userRecord = CKRecord(recordType: "User", recordID: userRecordID)
                            _ = try await container.privateCloudDatabase.save(userRecord)
                        }

                        // Set up schema with new field
                        try await setupSchema()
                    } catch {
                        print(
                            "🔴 CloudKitManager: Error getting user record ID: \(error.localizedDescription)"
                        )
                    }
                }

                isInitialized = true
            } catch {
                print(
                    "🔴 CloudKitManager: Error during initialization: \(error.localizedDescription)")
                if let ckError = error as? CKError {
                    print("🔴 CloudKitManager: CKError code: \(ckError.code.rawValue)")
                    handleCloudKitError(ckError)
                }
            }
        }

        func verifyContainerSetup() async throws {
            print("🟣 CloudKitManager: Verifying container setup")

            // Check account status
            let accountStatus = try await container.accountStatus()
            print("🟣 CloudKitManager: Account status: \(accountStatus)")

            guard accountStatus == .available else {
                print("🔴 CloudKitManager: No iCloud account available - will try to proceed anyway")
                return
            }

            // Try to fetch user record ID to verify container access
            do {
                let userRecordID = try await container.userRecordID()
                print(
                    "🟣 CloudKitManager: Successfully fetched user record ID: \(userRecordID.recordName)"
                )
            } catch {
                print(
                    "🟣 CloudKitManager: Warning - could not fetch user record ID: \(error.localizedDescription)"
                )
                // Continue anyway
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

            // If we get here, try to work with private database only
            do {
                // Create a test record in the private database
                let testGame = Game(
                    title: "Test Game",
                    isBinaryScore: false,
                    supportedPlayerCounts: [2],
                    createdByID: nil
                )

                // Create new record
                let record = CKRecord(recordType: "Game")
                record["id"] = testGame.id as NSString
                record["title"] = testGame.title as NSString
                record["isBinaryScore"] = NSNumber(value: testGame.isBinaryScore ? 1 : 0)
                record["countAllScores"] = NSNumber(value: testGame.countAllScores ? 1 : 0)
                record["countLosersOnly"] = NSNumber(value: testGame.countLosersOnly ? 1 : 0)
                record["highestScoreWins"] = NSNumber(value: testGame.highestScoreWins ? 1 : 0)
                record["highestRoundScoreWins"] = NSNumber(
                    value: testGame.highestRoundScoreWins ? 1 : 0)
                if let countsData = try? JSONEncoder().encode(Array(testGame.supportedPlayerCounts))
                {
                    record["supportedPlayerCounts"] = countsData as NSData
                }

                // Try to save to private database
                _ = try await database.save(record)
                print("🟣 CloudKitManager: Successfully created test record in private database")

                // Immediately delete the test record
                try await database.deleteRecord(withID: record.recordID)
                print("🟣 CloudKitManager: Successfully cleaned up test record")

            } catch {
                print(
                    "🟣 CloudKitManager: Error during private database test: \(error.localizedDescription)"
                )
                // Don't throw - we'll try to continue anyway
            }

            print("🟣 CloudKitManager: Schema update complete")
        }

        func setupSchema() async throws {
            do {
                print("🟣 CloudKitManager: Starting schema setup")

                // First verify the container setup
                try await verifyContainerSetup()

                // Try to update schema, but don't fail if it doesn't work
                try? await updateSchema()

                print("🟣 CloudKitManager: Schema setup complete")
            } catch {
                print("🟣 CloudKitManager: Schema setup warning: \(error.localizedDescription)")
                // Don't throw errors during setup - we'll try to proceed anyway
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
                // Use a simple predicate that matches all records with a non-empty title
                let query = CKQuery(
                    recordType: "Game",
                    predicate: NSPredicate(format: "title != ''")
                )
                query.sortDescriptors = [NSSortDescriptor(key: "title", ascending: true)]

                let (results, _) = try await database.records(matching: query)
                print("🟣 CloudKitManager: Found \(results.count) game records")

                var newGames: [Game] = []
                for result in results {
                    if let record = try? result.1.get(),
                        let game = Game(from: record)
                    {
                        print("🟣 CloudKitManager: Successfully parsed game: \(game.title)")
                        newGames.append(game)
                    }
                }

                print("🟣 CloudKitManager: Successfully parsed \(newGames.count) games")

                await MainActor.run {
                    self.games = newGames
                    // Sort games by title
                    self.games.sort {
                        $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
                    }
                    // Notify observers of the change
                    objectWillChange.send()
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
            print("🟣 CloudKitManager: Starting to save game: \(game.title)")
            try await ensureCloudKitAccess()

            do {
                // Create new record
                let record = CKRecord(recordType: "Game")
                record["id"] = game.id as NSString
                record["title"] = game.title as NSString
                record["isBinaryScore"] = NSNumber(value: game.isBinaryScore ? 1 : 0)
                record["countAllScores"] = NSNumber(value: game.countAllScores ? 1 : 0)
                record["countLosersOnly"] = NSNumber(value: game.countLosersOnly ? 1 : 0)
                record["highestScoreWins"] = NSNumber(value: game.highestScoreWins ? 1 : 0)
                record["highestRoundScoreWins"] = NSNumber(
                    value: game.highestRoundScoreWins ? 1 : 0)
                if let countsData = try? JSONEncoder().encode(Array(game.supportedPlayerCounts)) {
                    record["supportedPlayerCounts"] = countsData as NSData
                }
                if let createdByID = game.createdByID {
                    record["createdByID"] = createdByID as NSString
                    // Set up creator reference for permissions
                    let creatorReference = CKRecord.Reference(
                        recordID: CKRecord.ID(recordName: createdByID),
                        action: .none
                    )
                    record["creatorReference"] = creatorReference
                }

                let savedRecord = try await database.save(record)
                guard let updatedGame = try Game(from: savedRecord) else {
                    throw CloudKitError.recordConversionFailed
                }

                await MainActor.run {
                    if let index = games.firstIndex(where: { $0.id == game.id }) {
                        games[index] = updatedGame
                    } else {
                        games.append(updatedGame)
                    }
                    // Sort games by title
                    games.sort {
                        $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
                    }
                    // Notify observers of the change
                    objectWillChange.send()
                }

                print("🟣 CloudKitManager: Successfully saved game: \(game.title)")

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
                        matchCache.removeValue(forKey: game.id)
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
                            matchCache.removeValue(forKey: game.id)
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
                query.sortDescriptors = [NSSortDescriptor(key: "date", ascending: false)]

                let (results, _) = try await database.records(
                    matching: query,
                    resultsLimit: 100  // Assuming a default limit
                )

                print("🟣 CloudKitManager: Found \(results.count) match records")

                let matches = results.compactMap { result -> Match? in
                    guard let record = try? result.1.get() else {
                        print("🟣 CloudKitManager: Failed to get match record")
                        return nil
                    }
                    print(
                        "🟣 CloudKitManager: Processing match record: \(record.recordID.recordName)")

                    // Ensure required fields exist
                    guard let playerIDsData = record["playerIDs"] as? Data,
                        let playerIDs = try? JSONDecoder().decode(
                            [String].self, from: playerIDsData),
                        !playerIDs.isEmpty
                    else {
                        print("🟣 CloudKitManager: Match record missing required fields")
                        return nil
                    }

                    var match = Match(from: record)
                    match?.game = game
                    return match
                }
                print("🟣 CloudKitManager: Successfully parsed \(matches.count) matches")

                // Update cache
                matchCache[game.id] = matches

                return matches
            } catch {
                print("🟣 CloudKitManager: Error fetching matches: \(error)")
                throw error
            }
        }

        func saveMatch(_ match: Match) async throws {
            print("🟣 CloudKitManager: Saving match with ID: \(match.id)")

            // Validate that match has required fields
            guard let game = match.game else {
                print("🟣 CloudKitManager: Cannot save match without game")
                throw CloudKitError.missingData
            }

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
            var matches = matchCache[game.id] ?? []
            if let index = matches.firstIndex(where: { $0.id == match.id }) {
                matches[index] = updatedMatch
            } else {
                matches.append(updatedMatch)
            }
            matchCache[game.id] = matches

            // Update game's matches without triggering a refresh
            if let gameIndex = games.firstIndex(where: { $0.id == game.id }) {
                games[gameIndex].matches = matches
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
            case noAccount
            case restricted
            case couldNotDetermine
            case unknown

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
                case .noAccount:
                    return "No iCloud account found"
                case .restricted:
                    return "iCloud access is restricted"
                case .couldNotDetermine:
                    return "Could not determine iCloud account status"
                case .unknown:
                    return "An unknown error occurred"
                }
            }
        }

        func handleRecordChange(_ record: CKRecord) async {
            switch record.recordType {
            case "Player":
                if let id = record.value(forKey: "id") as? String,
                    let player = Player(from: record)
                {
                    updatePlayerCache(player)
                }
            case "Game":
                _ = try? await fetchGames()
            case "Match":
                matchCache.removeAll()
                clearPlayerMatchesCache()
                clearGroupMatchesCache()
            default:
                break
            }
        }

        func handleSubscriptionNotification(for recordType: String, recordID: CKRecord.ID? = nil) {
            refreshDebounceTask?.cancel()

            refreshDebounceTask = Task { [weak self] in
                do {
                    try await Task.sleep(for: .seconds(self?.debounceInterval ?? 2.0))
                    guard !Task.isCancelled else { return }

                    switch recordType {
                    case "Player":
                        if let recordID = recordID {
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
                        self?.matchCache.removeAll()
                        self?.clearPlayerMatchesCache()
                        self?.clearGroupMatchesCache()
                    case "PlayerGroup":
                        // Reset the refresh time to force a fresh fetch
                        self?.lastPlayerGroupRefreshTime = .distantPast
                        _ = try? await self?.fetchPlayerGroups()
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
                // Get the current user ID
                let userID = await self.userID
                guard let userID = userID else {
                    await MainActor.run {
                        self.playerGroups = []
                        playerGroupCache.removeAll()
                        lastPlayerGroupRefreshTime = now
                    }
                    return []
                }

                // First fetch all matches from the last month
                let oneMonthAgo =
                    Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
                let matchPredicate = NSPredicate(format: "date >= %@", oneMonthAgo as NSDate)
                let matchQuery = CKQuery(recordType: "Match", predicate: matchPredicate)
                matchQuery.sortDescriptors = [NSSortDescriptor(key: "date", ascending: false)]

                let (matchResults, _) = try await database.records(matching: matchQuery)

                // First ensure we have all games loaded
                let allGames = try await fetchGames(forceRefresh: false)
                let gamesById = Dictionary(uniqueKeysWithValues: allGames.map { ($0.id, $0) })

                // Extract unique player combinations from matches
                var playerCombinations: Set<Set<String>> = []
                var matchesByPlayerSet: [Set<String>: [Match]] = [:]

                for result in matchResults {
                    guard let record = try? result.1.get(),
                        let playerIDsData = record["playerIDs"] as? Data,
                        let playerIDs = try? JSONDecoder().decode(
                            [String].self, from: playerIDsData),
                        var match = Match(from: record),
                        let gameID = record["gameID"] as? String,
                        let game = gamesById[gameID]
                    else { continue }

                    // Set the game on the match
                    match.game = game

                    let playerSet = Set(playerIDs)
                    playerCombinations.insert(playerSet)
                    matchesByPlayerSet[playerSet, default: []].append(match)
                }

                // Create or update groups for each player combination
                var newGroups: [PlayerGroup] = []
                for playerSet in playerCombinations {
                    let playerIDs = Array(playerSet)
                    let name = generateGroupName(for: playerIDs)
                    let group = PlayerGroup(name: name, playerIDs: playerIDs, createdByID: userID)

                    // Cache matches for this group
                    if let matches = matchesByPlayerSet[playerSet] {
                        cacheGroupMatches(matches, for: group.id)
                    }

                    newGroups.append(group)
                }

                // Update everything at once to avoid UI flicker
                await MainActor.run {
                    self.playerGroups = newGroups
                    newGroups.forEach { playerGroupCache[$0.id] = $0 }
                    lastPlayerGroupRefreshTime = now
                }

                return newGroups
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
            let predicate = NSPredicate(format: "id != %@", "")
            let query = CKQuery(recordType: "PlayerGroup", predicate: predicate)
            let (results, _) = try await database.records(matching: query)

            // Find a matching group by decoding and comparing playerIDs
            for result in results {
                guard let record = try? result.1.get(),
                    let playerIDsData = record["playerIDs"] as? Data,
                    let existingPlayerIDs = try? JSONDecoder().decode(
                        [String].self, from: playerIDsData),
                    let group = PlayerGroup(from: record)
                else { continue }

                // Compare sorted arrays
                if Set(existingPlayerIDs) == Set(sortedPlayerIDs) {
                    // Update the group name if it's different from the suggested name
                    if let suggestedName = suggestedName, group.name != suggestedName {
                        var updatedGroup = group
                        updatedGroup.name = suggestedName
                        try await savePlayerGroup(updatedGroup)
                        return updatedGroup
                    }
                    return group
                }
            }

            // No matching group found, create a new one
            let name = suggestedName ?? generateGroupName(for: sortedPlayerIDs)
            let userID = await self.userID
            let group = PlayerGroup(name: name, playerIDs: sortedPlayerIDs, createdByID: userID)

            do {
                try await savePlayerGroup(group)
                return group
            } catch let error as CKError {
                // On any CloudKit error, try to fetch one more time
                let (retryResults, _) = try await database.records(matching: query)
                for result in retryResults {
                    guard let record = try? result.1.get(),
                        let playerIDsData = record["playerIDs"] as? Data,
                        let existingPlayerIDs = try? JSONDecoder().decode(
                            [String].self, from: playerIDsData),
                        let existingGroup = PlayerGroup(from: record)
                    else { continue }

                    if Set(existingPlayerIDs) == Set(sortedPlayerIDs) {
                        return existingGroup
                    }
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
            _ = try await fetchPlayers(forceRefresh: false)

            // Then force a fresh fetch of groups (which will also fetch and cache matches)
            let groups = try await fetchPlayerGroups()

            // Return the cached matches for each group
            var groupMatches: [String: [Match]] = [:]
            for group in groups {
                if let matches = getGroupMatches(group.id) {
                    groupMatches[group.id] = matches
                }
            }

            return groupMatches
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
                predicate: NSPredicate(format: "appleUserID == %@", appleUserID)
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
                predicate: NSPredicate(format: "ownerID == %@", appleUserID)
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

            // Try to find by ID directly
            let idQuery = CKQuery(
                recordType: "Player",
                predicate: NSPredicate(format: "id == %@", appleUserID)
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
            print("🟣 CloudKitManager: Fetching recent matches for player: \(playerId)")
            try await ensureCloudKitAccess()

            // First ensure we have the latest games
            let allGames = try await fetchGames()
            print("🟣 CloudKitManager: Fetched \(allGames.count) games")

            // Create a query for matches with a date sort
            let sort = NSSortDescriptor(key: "date", ascending: false)
            let startDate = Calendar.current.date(byAdding: .month, value: -6, to: Date()) ?? Date()
            let predicate = NSPredicate(format: "date >= %@", startDate as NSDate)
            let query = CKQuery(recordType: "Match", predicate: predicate)
            query.sortDescriptors = [sort]

            let (results, _) = try await database.records(
                matching: query,
                resultsLimit: limit * 5  // Fetch more to account for filtering
            )
            print("🟣 CloudKitManager: Found \(results.count) match records")

            let matches = try results.compactMap { result -> Match? in
                do {
                    let record = try result.1.get()
                    print("🟣 CloudKitManager: Processing record: \(record.recordID.recordName)")

                    // Ensure required fields exist
                    guard let gameId = record["gameID"] as? String else {
                        print("🟣 CloudKitManager: Missing gameID")
                        return nil
                    }

                    guard let playerIDsData = record["playerIDs"] as? Data else {
                        print("🟣 CloudKitManager: Missing playerIDs data")
                        return nil
                    }

                    let playerIDs: [String]
                    do {
                        playerIDs = try JSONDecoder().decode([String].self, from: playerIDsData)
                        print("🟣 CloudKitManager: Found playerIDs: \(playerIDs)")
                    } catch {
                        print("🟣 CloudKitManager: Failed to decode playerIDs: \(error)")
                        return nil
                    }

                    guard playerIDs.contains(playerId) else {
                        print("🟣 CloudKitManager: Player \(playerId) not in match")
                        return nil
                    }

                    guard let game = allGames.first(where: { $0.id == gameId }) else {
                        print("🟣 CloudKitManager: Game \(gameId) not found")
                        return nil
                    }

                    guard let match = Match(from: record) else {
                        print("🟣 CloudKitManager: Failed to create Match from record")
                        return nil
                    }

                    var updatedMatch = match
                    updatedMatch.game = game
                    print("🟣 CloudKitManager: Successfully created match")
                    return updatedMatch
                } catch {
                    print("🟣 CloudKitManager: Error processing record: \(error)")
                    return nil
                }
            }
            .prefix(limit)

            let sortedMatches = Array(matches).sorted { $0.date > $1.date }
            print("🟣 CloudKitManager: Returning \(sortedMatches.count) matches for player")

            // Cache the matches
            cachePlayerMatches(sortedMatches, for: playerId)

            return sortedMatches
        }

        func fetchRecentMatches(forGroup groupId: String, limit: Int) async throws -> [Match] {
            try await ensureCloudKitAccess()

            // First ensure we have the latest games
            let allGames = try await fetchGames()
            print("🟣 CloudKitManager: Fetched \(allGames.count) games")

            // Get the player IDs for this group
            let groupRecordID = CKRecord.ID(recordName: groupId)
            let groupRecord = try await database.record(for: groupRecordID)
            guard let groupData = groupRecord["playerIDs"] as? Data,
                let playerIDs = try? JSONDecoder().decode([String].self, from: groupData)
            else {
                return []
            }

            // Create a query for matches with a date sort
            let sort = NSSortDescriptor(key: "date", ascending: false)
            let startDate = Calendar.current.date(byAdding: .month, value: -6, to: Date()) ?? Date()
            let predicate = NSPredicate(format: "date >= %@", startDate as NSDate)
            let query = CKQuery(recordType: "Match", predicate: predicate)
            query.sortDescriptors = [sort]

            let (results, _) = try await database.records(
                matching: query,
                resultsLimit: limit * 5  // Fetch more to account for filtering
            )

            let matches = try results.compactMap { result -> Match? in
                guard let record = try? result.1.get() else { return nil }

                // Ensure required fields exist and all group players are in the match
                guard let gameId = record["gameID"] as? String,
                    let game = allGames.first(where: { $0.id == gameId }),
                    let playerIDsData = record["playerIDs"] as? Data,
                    let matchPlayerIDs = try? JSONDecoder().decode(
                        [String].self, from: playerIDsData),
                    !matchPlayerIDs.isEmpty,
                    Set(playerIDs).isSubset(of: Set(matchPlayerIDs))  // Check if all group players are in the match
                else {
                    return nil
                }

                guard var match = Match(from: record) else { return nil }
                match.game = game
                match.gameID = game.id
                return match
            }
            .prefix(limit)

            let sortedMatches = Array(matches).sorted { $0.date > $1.date }

            // Cache the matches
            cacheGroupMatches(sortedMatches, for: groupId)

            return sortedMatches
        }

        // MARK: - Match Cache Methods

        func getMatchesForGame(_ gameId: String) -> [Match]? {
            return matchCache[gameId]
        }

        func cacheMatchesForGame(_ matches: [Match], gameId: String) {
            matchCache[gameId] = matches
        }

        func getMatchesForPlayer(_ playerId: String) -> [Match]? {
            let matches = playerMatchesCache[playerId]
            print(
                "🟣 CloudKitManager: Getting \(matches?.count ?? 0) cached matches for player \(playerId)"
            )
            return matches
        }

        func cacheMatchesForPlayer(_ matches: [Match], playerId: String) {
            print("🟣 CloudKitManager: Caching \(matches.count) matches for player \(playerId)")
            playerMatchesCache[playerId] = matches
        }

        func getMatchesForGroup(_ groupId: String) -> [Match]? {
            return groupMatchesCache[groupId]
        }

        func cacheMatchesForGroup(_ matches: [Match], groupId: String) {
            groupMatchesCache[groupId] = matches
        }

        // MARK: - Activity Methods

        func fetchRecentActivityMatches(limit: Int, daysBack: Int = 3) async throws -> [Match] {
            try await ensureCloudKitAccess()

            let calendar = Calendar.current
            let startDate = calendar.date(byAdding: .day, value: -daysBack, to: Date()) ?? Date()

            // First ensure we have the latest games
            let allGames = try await fetchGames()
            print("🟣 CloudKitManager: Fetched \(allGames.count) games")

            // Update predicate to ensure we only get valid matches
            let predicate = NSPredicate(
                format: "date >= %@ AND gameID != ''",
                startDate as NSDate
            )
            let sort = NSSortDescriptor(key: "date", ascending: false)
            let query = CKQuery(recordType: "Match", predicate: predicate)
            query.sortDescriptors = [sort]

            let (results, _) = try await database.records(
                matching: query,
                resultsLimit: limit
            )

            let matches = try results.compactMap { result -> Match? in
                guard let record = try? result.1.get() else { return nil }

                // Ensure the match has required fields
                guard let gameId = record["gameID"] as? String,
                    let playerIDsData = record["playerIDs"] as? Data,
                    let playerIDs = try? JSONDecoder().decode(
                        [String].self, from: playerIDsData),
                    !playerIDs.isEmpty,
                    let game = allGames.first(where: { $0.id == gameId })
                else {
                    return nil
                }

                var match = try? Match(from: record)
                match?.game = game
                return match
            }

            return matches.sorted { $0.date > $1.date }
        }

        func login() async throws {
            print("🟣 CloudKitManager: Starting login process")

            // First check account status
            let accountStatus = try await container.accountStatus()

            switch accountStatus {
            case .available:
                print("🟣 CloudKitManager: iCloud account is available")

                // Get current user's record ID
                let userRecordID = try await container.userRecordID()

                // Create a query to find the user's record by ID
                let query = CKQuery(
                    recordType: "User",
                    predicate: NSPredicate(format: "id == %@", userRecordID.recordName))

                // Try to fetch existing user record
                let results = try await database.records(matching: query)
                let matchingRecords = results.matchResults.compactMap { try? $0.1.get() }

                if let existingUserRecord = matchingRecords.first {
                    // User exists, update last login
                    existingUserRecord["lastLogin"] = Date() as CKRecordValue
                    _ = try await database.save(existingUserRecord)
                    print("🟣 CloudKitManager: Updated existing user record")

                    // Set current user
                    if let user = User(from: existingUserRecord) {
                        self.currentUser = user
                        print("🟣 CloudKitManager: Set current user from existing record")
                    }
                } else {
                    // Create new user record
                    let newUserRecord = CKRecord(recordType: "User")
                    newUserRecord["id"] = userRecordID.recordName as CKRecordValue
                    newUserRecord["lastLogin"] = Date() as CKRecordValue

                    // Save new user record
                    let savedRecord = try await database.save(newUserRecord)
                    print("🟣 CloudKitManager: Created new user record")

                    // Set current user
                    if let user = User(from: savedRecord) {
                        self.currentUser = user
                        print("🟣 CloudKitManager: Set current user from new record")
                    }
                }

                // Fetch initial data
                try await fetchGames()
                print("🟣 CloudKitManager: Login complete")

            case .noAccount:
                throw CloudKitError.noAccount
            case .restricted:
                throw CloudKitError.restricted
            case .couldNotDetermine:
                throw CloudKitError.couldNotDetermine
            @unknown default:
                throw CloudKitError.unknown
            }
        }

        func fetchMatches(for player: Player) async throws -> [Match] {
            // Check cache first
            if let cachedMatches = getPlayerMatches(player.id) {
                return cachedMatches
            }

            // Fetch recent matches from the last month
            let oneMonthAgo =
                Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
            let matchPredicate = NSPredicate(format: "date >= %@", oneMonthAgo as NSDate)
            let matchQuery = CKQuery(recordType: "Match", predicate: matchPredicate)
            matchQuery.sortDescriptors = [NSSortDescriptor(key: "date", ascending: false)]

            let (results, _) = try await database.records(matching: matchQuery)

            // Process matches and filter for this player
            let matches = results.compactMap { result -> Match? in
                guard let record = try? result.1.get(),
                    let match = Match(from: record),
                    match.playerIDs.contains(player.id)
                else { return nil }
                return match
            }

            // Cache the matches
            cachePlayerMatches(matches, for: player.id)

            return matches
        }
    }
#endif
