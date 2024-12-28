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
        private var isRefreshing = false
        private var matchCache: [String: [Match]] = [:]  // Cache matches by game ID

        @Published var games: [Game] = []
        @Published var players: [Player] = []
        @Published var isLoading = false
        @Published var error: Error?

        init() {
            self.container = CKContainer(identifier: "iCloud.com.gvaldivia.skunkapp")
            self.database = container.publicCloudDatabase
        }

        // MARK: - Schema Setup

        func setupSchema() async throws {
            do {
                // Create Game record type
                let gameRecord = CKRecord(recordType: "Game")
                gameRecord.setValue("Sample Game", forKey: "title")
                gameRecord.setValue(false, forKey: "isBinaryScore")
                let supportedPlayerCounts = try JSONEncoder().encode([2, 3, 4])
                gameRecord.setValue(supportedPlayerCounts, forKey: "supportedPlayerCounts")
                gameRecord.setValue("sample", forKey: "createdByID")
                gameRecord.setValue("sample", forKey: "id")

                // Create Player record type
                let playerRecord = CKRecord(recordType: "Player")
                playerRecord.setValue("Sample Player", forKey: "name")
                playerRecord.setValue(Data(), forKey: "photoData")
                playerRecord.setValue(Data(), forKey: "colorData")
                playerRecord.setValue("sample", forKey: "appleUserID")
                playerRecord.setValue("sample", forKey: "ownerID")
                playerRecord.setValue("sample", forKey: "id")

                // Create Match record type
                let matchRecord = CKRecord(recordType: "Match")
                matchRecord.setValue(Date(), forKey: "date")
                let playerIDs = try JSONEncoder().encode(["sample"])
                matchRecord.setValue(playerIDs, forKey: "playerIDs")
                let playerOrder = try JSONEncoder().encode(["sample"])
                matchRecord.setValue(playerOrder, forKey: "playerOrder")
                matchRecord.setValue("sample", forKey: "winnerID")
                matchRecord.setValue(false, forKey: "isMultiplayer")
                matchRecord.setValue("pending", forKey: "status")
                let invitedPlayerIDs = try JSONEncoder().encode(["sample"])
                matchRecord.setValue(invitedPlayerIDs, forKey: "invitedPlayerIDs")
                let acceptedPlayerIDs = try JSONEncoder().encode(["sample"])
                matchRecord.setValue(acceptedPlayerIDs, forKey: "acceptedPlayerIDs")
                matchRecord.setValue(Date(), forKey: "lastModified")
                matchRecord.setValue("sample", forKey: "createdByID")
                matchRecord.setValue("sample", forKey: "gameID")
                matchRecord.setValue("sample", forKey: "id")

                // Try to save the records to create the schema
                try await database.save(gameRecord)
                try await database.save(playerRecord)
                try await database.save(matchRecord)

                // Delete the sample records
                try await database.deleteRecord(withID: gameRecord.recordID)
                try await database.deleteRecord(withID: playerRecord.recordID)
                try await database.deleteRecord(withID: matchRecord.recordID)
            } catch {
                print("Schema setup completed with expected errors: \(error.localizedDescription)")
            }
        }

        // MARK: - Games

        func fetchGames() async throws -> [Game] {
            do {
                let query = CKQuery(
                    recordType: "Game", predicate: NSPredicate(format: "title != ''"))
                let (results, _) = try await database.records(matching: query)
                let games = results.compactMap { result -> Game? in
                    guard let record = try? result.1.get() else { return nil }
                    return Game(from: record)
                }
                self.games = games
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

        func fetchPlayers() async throws -> [Player] {
            do {
                print("🟣 CloudKitManager: Fetching players...")
                let query = CKQuery(
                    recordType: "Player", predicate: NSPredicate(format: "name != ''"))
                let (results, _) = try await database.records(matching: query)
                print("🟣 CloudKitManager: Found \(results.count) player records")

                let players = results.compactMap { result -> Player? in
                    guard let record = try? result.1.get() else {
                        print("🟣 CloudKitManager: Failed to get player record")
                        return nil
                    }
                    guard let name = record.value(forKey: "name") as? String else {
                        print("🟣 CloudKitManager: Failed to get player name")
                        return nil
                    }
                    guard let id = record.value(forKey: "id") as? String else {
                        print("🟣 CloudKitManager: Failed to get player ID for \(name)")
                        return nil
                    }
                    print("🟣 CloudKitManager: Processing player: \(name) with ID: \(id)")
                    return Player(from: record)
                }
                print("🟣 CloudKitManager: Successfully parsed \(players.count) players")

                // Update the players array
                self.players = players
                return players
            } catch let error as CKError {
                print("🟣 CloudKitManager: Error fetching players: \(error.localizedDescription)")
                handleCloudKitError(error)
                throw error
            }
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

        func refreshPlayers(force: Bool = false) async {
            // Prevent concurrent refreshes
            guard !isRefreshing else {
                print("🟣 CloudKitManager: Skipping refresh, already refreshing")
                return
            }

            // Debounce refreshes
            let now = Date()
            if !force && now.timeIntervalSince(lastRefreshTime) < 1.0 {
                print("🟣 CloudKitManager: Skipping refresh, too soon since last refresh")
                return
            }

            isRefreshing = true
            defer { isRefreshing = false }
            lastRefreshTime = now

            do {
                print("🟣 CloudKitManager: Refreshing players...")
                _ = try await fetchPlayers()
            } catch {
                print("🟣 CloudKitManager: Error refreshing players: \(error.localizedDescription)")
                self.error = error
            }
        }

        func fetchCurrentUserPlayer(userID: String) async throws -> Player? {
            do {
                print("Fetching current user player for ID: \(userID)")

                // Create a query with a simple predicate
                let query = CKQuery(
                    recordType: "Player", predicate: NSPredicate(format: "name != ''"))
                let (results, _) = try await database.records(matching: query)

                // Find the player with matching userID
                for result in results {
                    guard let record = try? result.1.get(),
                        let player = Player(from: record),
                        let appleUserID = record.value(forKey: "appleUserID") as? String,
                        appleUserID == userID
                    else { continue }

                    print("Found current user player: \(player.name)")
                    return player
                }

                print("No player found for user ID: \(userID)")
                return nil
            } catch let error as CKError {
                print("Error fetching current user player: \(error.localizedDescription)")
                handleCloudKitError(error)
                throw error
            }
        }

        func savePlayer(_ player: Player) async throws {
            var updatedPlayer = player
            let record = player.toRecord()
            let savedRecord = try await database.save(record)
            updatedPlayer.recordID = savedRecord.recordID
            updatedPlayer.record = savedRecord

            if let index = players.firstIndex(where: { $0.id == player.id }) {
                players[index] = updatedPlayer
            } else {
                players.append(updatedPlayer)
            }
        }

        func updatePlayer(_ player: Player) async throws {
            print("🟣 CloudKitManager: Updating player: \(player.name)")
            guard let record = player.record else {
                print("🟣 CloudKitManager: No record found, creating new player")
                try await savePlayer(player)
                return
            }

            // Update existing record with new values
            record.setValue(player.id, forKey: "id")
            record.setValue(player.name, forKey: "name")
            record.setValue(player.photoData, forKey: "photoData")
            record.setValue(player.colorData, forKey: "colorData")
            record.setValue(player.appleUserID, forKey: "appleUserID")
            record.setValue(player.ownerID, forKey: "ownerID")

            print("🟣 CloudKitManager: Saving updated player record")
            let savedRecord = try await database.save(record)
            print("🟣 CloudKitManager: Successfully saved player record")

            // Create an updated player with the saved record
            var updatedPlayer = player
            updatedPlayer.record = savedRecord
            updatedPlayer.recordID = savedRecord.recordID

            // Update local cache immediately
            if let index = players.firstIndex(where: { $0.id == player.id }) {
                print("🟣 CloudKitManager: Updating player in local cache")
                players[index] = updatedPlayer
            } else {
                print("🟣 CloudKitManager: Adding player to local cache")
                players.append(updatedPlayer)
            }

            // Force UI update
            objectWillChange.send()
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
            }
        }

        // MARK: - Error Handling

        enum CloudKitError: Error {
            case missingData
        }

        func deleteAllPlayers() async throws {
            print("🟣 CloudKitManager: Starting to delete all players...")
            let query = CKQuery(recordType: "Player", predicate: NSPredicate(value: true))
            let (results, _) = try await database.records(matching: query)
            print("🟣 CloudKitManager: Found \(results.count) players to delete")

            for result in results {
                do {
                    let record = try result.1.get()
                    print(
                        "🟣 CloudKitManager: Deleting player: \(record.value(forKey: "name") ?? "unknown")"
                    )
                    try await database.deleteRecord(withID: record.recordID)
                    print("🟣 CloudKitManager: Successfully deleted player record")
                } catch {
                    print(
                        "🟣 CloudKitManager: Error deleting player record: \(error.localizedDescription)"
                    )
                }
            }

            // Clear local cache
            players.removeAll()
            print("🟣 CloudKitManager: Successfully deleted all players")

            // Refresh the players list
            await refreshPlayers()
        }
    }
#endif
