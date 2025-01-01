import CloudKit
import Foundation

#if canImport(UIKit)
    class Game: Identifiable, Hashable {
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
        var winningConditions: String = "game:high|round:high"  // Default both to high
        var highestRoundScoreWins: Bool {
            get {
                let components = winningConditions.split(separator: "|")
                if let roundComponent = components.first(where: { $0.hasPrefix("round:") }) {
                    return roundComponent.contains("high")
                }
                return true  // Default to high score wins
            }
            set {
                let components = winningConditions.split(separator: "|")
                let gameComponent =
                    components.first(where: { $0.hasPrefix("game:") }) ?? "game:high"
                let roundCondition = "round:" + (newValue ? "high" : "low")
                winningConditions = "\(gameComponent)|\(roundCondition)"

                // Recalculate winners for all matches when conditions change
                Task {
                    if let matches = matches {
                        for var match in matches {
                            // For non-binary score games, recalculate winner based on new conditions
                            if !isBinaryScore {
                                let totalScores = match.rounds.reduce(
                                    Array(repeating: 0, count: match.playerIDs.count)
                                ) { totals, roundScores in
                                    if countLosersOnly {
                                        // Find the winner of this round
                                        let scores = roundScores
                                        let winnerIndex =
                                            highestRoundScoreWins
                                            ? scores.firstIndex(of: scores.max() ?? 0) ?? 0
                                            : scores.firstIndex(of: scores.min() ?? 0) ?? 0

                                        // Add up all losers' scores
                                        let losersTotal = scores.enumerated()
                                            .filter { $0.offset != winnerIndex }
                                            .map { $0.element }
                                            .reduce(0, +)

                                        // Add losers' total to the running total for the winner
                                        var newTotals = totals
                                        newTotals[winnerIndex] += losersTotal
                                        return newTotals
                                    } else {
                                        return zip(totals, roundScores).map(+)
                                    }
                                }

                                // Set winner based on new game conditions
                                if let maxScore = totalScores.max(),
                                    let minScore = totalScores.min()
                                {
                                    let winnerIndex =
                                        highestScoreWins
                                        ? totalScores.firstIndex(of: maxScore)
                                        : totalScores.firstIndex(of: minScore)
                                    if let winnerIndex = winnerIndex {
                                        match.winnerID = match.playerIDs[winnerIndex]
                                        do {
                                            try await CloudKitManager.shared.saveMatch(match)
                                        } catch {
                                            print("Error updating match winner: \(error)")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
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
            self.highestRoundScoreWins = highestRoundScoreWins
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

            // Parse winning conditions from string
            if let conditions = record["winningConditions"] as? String {
                self.winningConditions = conditions
                // Extract highestRoundScoreWins from winningConditions string
                let components = conditions.split(separator: "|")
                if components.count > 1 {
                    let roundComponent = components[1]
                    self.highestRoundScoreWins = roundComponent.contains("high")
                } else {
                    self.highestRoundScoreWins = true  // Default to true if not found
                }
            } else {
                // If no winning conditions string exists, create one from highestScoreWins
                let gameCondition = "game:" + (self.highestScoreWins ? "high" : "low")
                let roundCondition = "round:high"  // Default to high
                self.winningConditions = "\(gameCondition)|\(roundCondition)"
                self.highestRoundScoreWins = true
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

            // Update winningConditions string to reflect both game and round conditions
            let gameCondition = "game:" + (highestScoreWins ? "high" : "low")
            let roundCondition = "round:" + (highestRoundScoreWins ? "high" : "low")
            self.winningConditions = "\(gameCondition)|\(roundCondition)"
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
