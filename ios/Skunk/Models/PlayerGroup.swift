import CloudKit
import Foundation

#if canImport(UIKit)
    struct PlayerGroup: Identifiable, Hashable {
        let id: String
        var name: String
        var playerIDs: [String]
        var createdByID: String?
        var record: CKRecord?
        var recordID: CKRecord.ID?

        init(name: String, playerIDs: [String], createdByID: String? = nil) {
            self.id = UUID().uuidString
            self.name = name
            self.playerIDs = playerIDs.sorted()  // Sort to ensure consistent comparison
            self.createdByID = createdByID
            self.recordID = nil
        }

        init?(from record: CKRecord) {
            guard let id = record.value(forKey: "id") as? String,
                let name = record.value(forKey: "name") as? String
            else { return nil }

            self.id = id
            self.name = name
            if let playerIDsData = record.value(forKey: "playerIDs") as? Data,
                let ids = try? JSONDecoder().decode([String].self, from: playerIDsData)
            {
                self.playerIDs = ids.sorted()  // Sort to ensure consistent comparison
            } else {
                self.playerIDs = []
            }
            self.createdByID = record.value(forKey: "createdByID") as? String
            self.record = record
            self.recordID = record.recordID
        }

        func toRecord() -> CKRecord {
            let record: CKRecord
            if let existingRecordID = recordID {
                record = CKRecord(recordType: "PlayerGroup", recordID: existingRecordID)
            } else {
                record = CKRecord(recordType: "PlayerGroup")
            }

            record.setValue(id, forKey: "id")
            record.setValue(name, forKey: "name")
            if let playerIDsData = try? JSONEncoder().encode(playerIDs) {
                record.setValue(playerIDsData, forKey: "playerIDs")
            }
            record.setValue(createdByID, forKey: "createdByID")

            return record
        }

        // Helper method to check if this group matches a set of player IDs
        func matches(playerIDs: [String]) -> Bool {
            Set(self.playerIDs) == Set(playerIDs)
        }

        // MARK: - Hashable

        func hash(into hasher: inout Hasher) {
            hasher.combine(id)
        }

        static func == (lhs: PlayerGroup, rhs: PlayerGroup) -> Bool {
            lhs.id == rhs.id
        }
    }
#endif
