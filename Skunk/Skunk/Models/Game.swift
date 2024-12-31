import CloudKit
import Foundation

#if canImport(UIKit)
    struct Game: Identifiable, Hashable {
        let id: String
        var title: String
        var isBinaryScore: Bool
        var supportsMultipleRounds: Bool
        var supportedPlayerCounts: Set<Int>
        var createdByID: String?
        var record: CKRecord?
        var matches: [Match]?
        var recordID: CKRecord.ID?
        var creationDate: Date?

        init(
            title: String, isBinaryScore: Bool, supportsMultipleRounds: Bool = false,
            supportedPlayerCounts: Set<Int>, createdByID: String? = nil
        ) {
            self.id = UUID().uuidString
            self.title = title
            self.isBinaryScore = isBinaryScore
            self.supportsMultipleRounds = supportsMultipleRounds
            self.supportedPlayerCounts = supportedPlayerCounts
            self.createdByID = createdByID
            self.matches = []
            self.recordID = nil
            self.creationDate = Date()
        }

        init?(from record: CKRecord) {
            guard let title = record.value(forKey: "title") as? String else { return nil }
            guard let id = record.value(forKey: "id") as? String else { return nil }

            self.id = id
            self.title = title
            self.isBinaryScore = record.value(forKey: "isBinaryScore") as? Bool ?? false
            self.supportsMultipleRounds =
                record.value(forKey: "supportsMultipleRounds") as? Bool ?? false
            if let countsData = record.value(forKey: "supportedPlayerCounts") as? Data,
                let counts = try? JSONDecoder().decode([Int].self, from: countsData)
            {
                self.supportedPlayerCounts = Set(counts)
            } else {
                self.supportedPlayerCounts = []
            }
            self.createdByID = record.value(forKey: "createdByID") as? String
            self.record = record
            self.matches = []
            self.recordID = record.recordID
            self.creationDate = record.creationDate
        }

        func toRecord() -> CKRecord {
            let record: CKRecord
            if let existingRecordID = recordID {
                record = CKRecord(recordType: "Game", recordID: existingRecordID)
            } else {
                record = CKRecord(recordType: "Game")
            }

            record.setValue(id, forKey: "id")
            record.setValue(title, forKey: "title")
            record.setValue(isBinaryScore, forKey: "isBinaryScore")
            record.setValue(supportsMultipleRounds, forKey: "supportsMultipleRounds")
            if let countsData = try? JSONEncoder().encode(Array(supportedPlayerCounts)) {
                record.setValue(countsData, forKey: "supportedPlayerCounts")
            }
            record.setValue(createdByID, forKey: "createdByID")

            return record
        }

        // MARK: - Hashable

        func hash(into hasher: inout Hasher) {
            hasher.combine(id)
        }

        static func == (lhs: Game, rhs: Game) -> Bool {
            lhs.id == rhs.id
        }
    }
#endif
