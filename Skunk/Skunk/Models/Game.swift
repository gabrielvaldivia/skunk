import CloudKit
import Foundation

#if canImport(UIKit)
    struct Game: Identifiable, Hashable {
        let id: String
        var title: String
        var isBinaryScore: Bool
        var supportedPlayerCounts: Set<Int>
        var createdByID: String?
        var countAllScores: Bool
        var countLosersOnly: Bool
        var highestScoreWins: Bool
        var record: CKRecord?
        var matches: [Match]?
        var recordID: CKRecord.ID?
        var creationDate: Date?

        init(
            title: String, isBinaryScore: Bool,
            supportedPlayerCounts: Set<Int>, createdByID: String? = nil,
            countAllScores: Bool = true, countLosersOnly: Bool = false,
            highestScoreWins: Bool = true
        ) {
            self.id = UUID().uuidString
            self.title = title
            self.isBinaryScore = isBinaryScore
            self.supportedPlayerCounts = supportedPlayerCounts
            self.createdByID = createdByID
            self.countAllScores = countAllScores
            self.countLosersOnly = countLosersOnly
            self.highestScoreWins = highestScoreWins
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
            self.countAllScores = record.value(forKey: "countAllScores") as? Bool ?? true
            self.countLosersOnly = record.value(forKey: "countLosersOnly") as? Bool ?? false
            self.highestScoreWins = record.value(forKey: "highestScoreWins") as? Bool ?? true
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
            record.setValue(countAllScores, forKey: "countAllScores")
            record.setValue(countLosersOnly, forKey: "countLosersOnly")
            record.setValue(highestScoreWins, forKey: "highestScoreWins")
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
