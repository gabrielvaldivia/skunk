import CloudKit
import Foundation
import SwiftUI

#if canImport(UIKit)
    @MainActor
    class CloudKitManager: ObservableObject {
        static let shared = CloudKitManager()
        private let container: CKContainer
        private let database: CKDatabase

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
                let query = CKQuery(
                    recordType: "Player", predicate: NSPredicate(format: "name != ''"))
                let (results, _) = try await database.records(matching: query)
                let players = results.compactMap { result -> Player? in
                    guard let record = try? result.1.get() else { return nil }
                    return Player(from: record)
                }
                self.players = players
                return players
            } catch let error as CKError {
                handleCloudKitError(error)
                throw error
            }
        }

        func refreshPlayers() async {
            do {
                _ = try await fetchPlayers()
            } catch {
                self.error = error
            }
        }

        func fetchCurrentUserPlayer(userID: String) async throws -> Player? {
            do {
                let query = CKQuery(
                    recordType: "Player",
                    predicate: NSPredicate(format: "appleUserID == %@", userID))
                let (results, _) = try await database.records(matching: query)
                guard let record = try? results.first?.1.get() else { return nil }
                return Player(from: record)
            } catch let error as CKError {
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
            guard let record = player.record else {
                // If no record exists, create one
                try await savePlayer(player)
                return
            }

            // Update existing record with new values
            record.setValue(player.name, forKey: "name")
            record.setValue(player.photoData, forKey: "photoData")
            record.setValue(player.colorData, forKey: "colorData")
            record.setValue(player.appleUserID, forKey: "appleUserID")
            record.setValue(player.ownerID, forKey: "ownerID")

            try await database.save(record)

            if let index = players.firstIndex(where: { $0.id == player.id }) {
                players[index] = player
            } else {
                players.append(player)
            }
        }

        func deletePlayer(_ player: Player) async throws {
            guard let recordID = player.recordID else {
                throw CloudKitError.missingData
            }
            try await database.deleteRecord(withID: recordID)
            players.removeAll { $0.id == player.id }
        }

        // MARK: - Matches

        func fetchMatches(for game: Game) async throws -> [Match] {
            do {
                let query = CKQuery(
                    recordType: "Match", predicate: NSPredicate(format: "gameID == %@", game.id))
                let (results, _) = try await database.records(matching: query)
                let matches = results.compactMap { result -> Match? in
                    guard let record = try? result.1.get() else { return nil }
                    var match = Match(from: record)
                    match?.game = game
                    return match
                }

                // Update the game's matches
                var updatedGame = game
                updatedGame.matches = matches
                if let index = games.firstIndex(where: { $0.id == game.id }) {
                    games[index] = updatedGame
                }

                return matches
            } catch let error as CKError {
                handleCloudKitError(error)
                throw error
            }
        }

        func saveMatch(_ match: Match) async throws {
            var updatedMatch = match
            let record = match.toRecord()
            let savedRecord = try await database.save(record)
            updatedMatch.recordID = savedRecord.recordID
            updatedMatch.record = savedRecord

            // Update the game's matches
            if let game = match.game,
                let index = games.firstIndex(where: { $0.id == game.id })
            {
                var updatedGame = game
                if updatedGame.matches == nil {
                    updatedGame.matches = []
                }
                if let matchIndex = updatedGame.matches?.firstIndex(where: { $0.id == match.id }) {
                    updatedGame.matches?[matchIndex] = updatedMatch
                } else {
                    updatedGame.matches?.append(updatedMatch)
                }
                games[index] = updatedGame
            }
        }

        func deleteMatch(_ match: Match) async throws {
            guard let recordID = match.recordID else {
                throw CloudKitError.missingData
            }
            try await database.deleteRecord(withID: recordID)

            // Update the game's matches
            if let game = match.game,
                let index = games.firstIndex(where: { $0.id == game.id })
            {
                var updatedGame = game
                updatedGame.matches?.removeAll { $0.id == match.id }
                games[index] = updatedGame
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
    }
#endif
