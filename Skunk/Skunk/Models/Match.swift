import CloudKit
import Foundation

#if canImport(UIKit)
    struct Match: Identifiable, Hashable {
        let id: String
        var date: Date
        var playerIDs: [String]
        var playerOrder: [String]
        var winnerID: String?
        var isMultiplayer: Bool
        var status: String
        var invitedPlayerIDs: [String]
        var acceptedPlayerIDs: [String]
        var lastModified: Date
        var createdByID: String?
        var record: CKRecord?
        var game: Game?
        var recordID: CKRecord.ID?

        init(date: Date = Date(), createdByID: String? = nil, game: Game? = nil) {
            self.id = UUID().uuidString
            self.date = date
            self.playerIDs = []
            self.playerOrder = []
            self.winnerID = nil
            self.isMultiplayer = false
            self.status = "pending"
            self.invitedPlayerIDs = []
            self.acceptedPlayerIDs = []
            self.lastModified = date
            self.createdByID = createdByID
            self.game = game
            self.recordID = nil
        }

        init?(from record: CKRecord) {
            self.id = UUID().uuidString
            self.date = record.value(forKey: "date") as? Date ?? Date()
            if let playerIDsData = record.value(forKey: "playerIDs") as? Data,
                let ids = try? JSONDecoder().decode([String].self, from: playerIDsData)
            {
                self.playerIDs = ids
            } else {
                self.playerIDs = []
            }
            if let orderData = record.value(forKey: "playerOrder") as? Data,
                let order = try? JSONDecoder().decode([String].self, from: orderData)
            {
                self.playerOrder = order
            } else {
                self.playerOrder = []
            }
            self.winnerID = record.value(forKey: "winnerID") as? String
            self.isMultiplayer = record.value(forKey: "isMultiplayer") as? Bool ?? false
            self.status = record.value(forKey: "status") as? String ?? "pending"
            if let invitedData = record.value(forKey: "invitedPlayerIDs") as? Data,
                let invited = try? JSONDecoder().decode([String].self, from: invitedData)
            {
                self.invitedPlayerIDs = invited
            } else {
                self.invitedPlayerIDs = []
            }
            if let acceptedData = record.value(forKey: "acceptedPlayerIDs") as? Data,
                let accepted = try? JSONDecoder().decode([String].self, from: acceptedData)
            {
                self.acceptedPlayerIDs = accepted
            } else {
                self.acceptedPlayerIDs = []
            }
            self.lastModified = record.value(forKey: "lastModified") as? Date ?? Date()
            self.createdByID = record.value(forKey: "createdByID") as? String
            self.record = record
            self.game = nil  // This will be set after fetching the game reference
            self.recordID = record.recordID
        }

        func toRecord() -> CKRecord {
            let record: CKRecord
            if let existingRecordID = recordID {
                record = CKRecord(recordType: "Match", recordID: existingRecordID)
            } else {
                record = CKRecord(recordType: "Match")
            }

            record.setValue(date, forKey: "date")
            if let playerIDsData = try? JSONEncoder().encode(playerIDs) {
                record.setValue(playerIDsData, forKey: "playerIDs")
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
            if let gameID = game?.id {
                record.setValue(gameID, forKey: "gameID")
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
