import CloudKit
import Foundation

#if canImport(UIKit)
    struct Match: Identifiable, Hashable {
        let id: String
        var recordID: CKRecord.ID?
        var record: CKRecord?
        var game: Game?
        var gameID: String
        var date: Date
        var playerIDs: [String]
        var playerIDsString: String
        var playerOrder: [String]
        var winnerID: String?
        var winner: Player?
        var isMultiplayer: Bool
        var status: String
        var invitedPlayerIDs: [String]
        var acceptedPlayerIDs: [String]
        var lastModified: Date
        var createdByID: String?
        var scores: [Int]
        var rounds: [[Int]]

        var computedWinnerID: String? {
            guard let game = game, !scores.isEmpty else { return winnerID }

            if game.isBinaryScore {
                if let index = scores.firstIndex(of: 1),
                    index < playerOrder.count
                {
                    return playerOrder[index]
                }
                return winnerID
            }

            if let index = game.highestScoreWins
                ? scores.indices.max(by: { scores[$0] < scores[$1] })
                : scores.indices.min(by: { scores[$0] < scores[$1] }),
                index < playerOrder.count
            {
                return playerOrder[index]
            }
            return winnerID
        }

        init(date: Date = Date(), createdByID: String? = nil, game: Game) {
            self.id = UUID().uuidString
            self.date = date
            self.playerIDs = []
            self.playerIDsString = ""
            self.playerOrder = []
            self.winnerID = nil
            self.winner = nil
            self.isMultiplayer = false
            self.status = "active"
            self.invitedPlayerIDs = []
            self.acceptedPlayerIDs = []
            self.lastModified = date
            self.createdByID = createdByID
            self.game = game
            self.gameID = game.id
            self.recordID = nil
            self.scores = []
            self.rounds = []
        }

        init?(from record: CKRecord) {
            guard let id = record["id"] as? String,
                let playerIDsData = record["playerIDs"] as? Data,
                let playerIDs = try? JSONDecoder().decode([String].self, from: playerIDsData),
                let gameID = record["gameID"] as? String,
                let date = record["date"] as? Date
            else { return nil }

            self.id = id
            self.playerIDs = playerIDs
            self.gameID = gameID
            self.date = date
            self.recordID = record.recordID
            self.record = record
            self.playerIDsString = playerIDs.sorted().joined(separator: ",")

            // Decode optional fields
            if let scoresData = record["scores"] as? Data {
                self.scores = (try? JSONDecoder().decode([Int].self, from: scoresData)) ?? []
            } else {
                self.scores = []
            }
            if let roundsData = record["rounds"] as? Data {
                self.rounds = (try? JSONDecoder().decode([[Int]].self, from: roundsData)) ?? []
            } else {
                self.rounds = []
            }
            if let playerOrderData = record["playerOrder"] as? Data {
                self.playerOrder =
                    (try? JSONDecoder().decode([String].self, from: playerOrderData)) ?? playerIDs
            } else {
                self.playerOrder = playerIDs
            }
            self.createdByID = record["createdByID"] as? String
            self.isMultiplayer = record["isMultiplayer"] as? Bool ?? (playerIDs.count > 1)
            self.status = record["status"] as? String ?? "active"
            self.winnerID = record["winnerID"] as? String
            self.winner = nil
            self.lastModified = record["lastModified"] as? Date ?? date

            if let invitedData = record["invitedPlayerIDs"] as? Data {
                self.invitedPlayerIDs =
                    (try? JSONDecoder().decode([String].self, from: invitedData)) ?? []
            } else {
                self.invitedPlayerIDs = []
            }

            if let acceptedData = record["acceptedPlayerIDs"] as? Data {
                self.acceptedPlayerIDs =
                    (try? JSONDecoder().decode([String].self, from: acceptedData)) ?? []
            } else {
                self.acceptedPlayerIDs = []
            }
        }

        func toRecord() -> CKRecord {
            let record: CKRecord
            if let existingRecordID = recordID {
                record = CKRecord(recordType: "Match", recordID: existingRecordID)
            } else {
                record = CKRecord(recordType: "Match")
            }

            record.setValue(id, forKey: "id")
            record.setValue(date, forKey: "date")

            if let playerIDsData = try? JSONEncoder().encode(playerIDs) {
                record.setValue(playerIDsData, forKey: "playerIDs")
                record.setValue(
                    playerIDs.sorted().joined(separator: ","), forKey: "playerIDsString")
            }

            if let orderData = try? JSONEncoder().encode(playerOrder) {
                record.setValue(orderData, forKey: "playerOrder")
            }
            record.setValue(winnerID, forKey: "winnerID")
            record.setValue(isMultiplayer, forKey: "isMultiplayer")
            record.setValue(status, forKey: "status")
            if let invitedData = try? JSONEncoder().encode(invitedPlayerIDs) {
                record.setValue(invitedData, forKey: "invitedPlayerIDs")
            }
            if let acceptedData = try? JSONEncoder().encode(acceptedPlayerIDs) {
                record.setValue(acceptedData, forKey: "acceptedPlayerIDs")
            }
            record.setValue(lastModified, forKey: "lastModified")
            record.setValue(createdByID, forKey: "createdByID")

            // Always require a game ID
            guard let gameID = game?.id else {
                fatalError("Cannot create a match record without a game ID")
            }
            record.setValue(gameID, forKey: "gameID")

            if let scoresData = try? JSONEncoder().encode(scores) {
                record.setValue(scoresData, forKey: "scores")
            }

            if let roundsData = try? JSONEncoder().encode(rounds) {
                record.setValue(roundsData, forKey: "rounds")
            }

            return record
        }

        // MARK: - Hashable

        func hash(into hasher: inout Hasher) {
            hasher.combine(id)
        }

        static func == (lhs: Match, rhs: Match) -> Bool {
            lhs.id == rhs.id
        }
    }
#endif
