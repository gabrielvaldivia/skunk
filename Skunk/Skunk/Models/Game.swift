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
        private var winningConditions: String = "game:high|round:high"  // Default both to high

        // Computed property for round winning condition
        var highestRoundScoreWins: Bool {
            get {
                let conditions = winningConditions.split(separator: "|")
                if let roundCondition = conditions.first(where: { $0.hasPrefix("round:") }) {
                    return roundCondition.contains(":high")
                }
                return true  // Default to high score wins
            }
            set {
                let gameCondition = "game:" + (highestScoreWins ? "high" : "low")
                let roundCondition = "round:" + (newValue ? "high" : "low")
                winningConditions = "\(gameCondition)|\(roundCondition)"
            }
        }

        init(
            title: String, isBinaryScore: Bool,
            supportedPlayerCounts: Set<Int>, createdByID: String? = nil,
            countAllScores: Bool = true, countLosersOnly: Bool = false,
            highestScoreWins: Bool = true, highestRoundScoreWins: Bool = true
        ) {
            self.id = UUID().uuidString
            self.title = title
            self.isBinaryScore = isBinaryScore
            self.supportedPlayerCounts = supportedPlayerCounts
            self.createdByID = createdByID
            self.countAllScores = countAllScores
            self.countLosersOnly = countLosersOnly
            self.highestScoreWins = highestScoreWins
            let gameCondition = "game:" + (highestScoreWins ? "high" : "low")
            let roundCondition = "round:" + (highestRoundScoreWins ? "high" : "low")
            self.winningConditions = "\(gameCondition)|\(roundCondition)"
            self.matches = []
            self.recordID = nil
            self.creationDate = Date()
        }

        init?(from record: CKRecord) {
            guard let id = record["id"] as? String,
                let title = record["title"] as? String,
                let isBinaryScore = record["isBinaryScore"] as? Int,
                let supportedPlayerCountsData = record["supportedPlayerCounts"] as? Data,
                let supportedPlayerCounts = try? JSONDecoder().decode(
                    Set<Int>.self, from: supportedPlayerCountsData)
            else {
                return nil
            }

            self.id = id
            self.title = title
            self.isBinaryScore = isBinaryScore == 1
            self.supportedPlayerCounts = supportedPlayerCounts
            self.createdByID = record["createdByID"] as? String
            self.countAllScores = (record["countAllScores"] as? Int ?? 0) == 1
            self.countLosersOnly = (record["countLosersOnly"] as? Int ?? 0) == 1
            self.highestScoreWins = (record["highestScoreWins"] as? Int ?? 1) == 1

            // Parse winning conditions from string or use defaults
            if let conditions = record["winningConditions"] as? String {
                self.winningConditions = conditions
            } else {
                // If no winning conditions string exists, create one from highestScoreWins
                let gameCondition = "game:" + (self.highestScoreWins ? "high" : "low")
                let roundCondition = "round:" + (self.highestScoreWins ? "high" : "low")
                self.winningConditions = "\(gameCondition)|\(roundCondition)"
            }

            self.record = record
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
            record.setValue(isBinaryScore ? 1 : 0, forKey: "isBinaryScore")
            record.setValue(countAllScores ? 1 : 0, forKey: "countAllScores")
            record.setValue(countLosersOnly ? 1 : 0, forKey: "countLosersOnly")
            record.setValue(highestScoreWins ? 1 : 0, forKey: "highestScoreWins")
            record.setValue(winningConditions, forKey: "winningConditions")
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
