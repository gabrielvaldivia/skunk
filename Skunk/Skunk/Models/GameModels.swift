import Foundation
import SwiftData

#if canImport(UIKit)
    import UIKit
#else
    import AppKit
#endif

@Model
final class Player {
    var name: String?
    var photoData: Data?
    var colorData: Data?
    @Relationship(deleteRule: .nullify) var matches: [Match]?
    @Relationship(deleteRule: .nullify) var scores: [Score]?

    init(name: String, photoData: Data? = nil) {
        self.name = name
        self.photoData = photoData
        self.matches = []
        self.scores = []
        // Generate a consistent color based on the name
        let hash = abs(name.hashValue)
        let hue = Double(hash % 255) / 255.0
        #if canImport(UIKit)
            let color = UIColor(hue: CGFloat(hue), saturation: 0.7, brightness: 0.9, alpha: 1.0)
        #else
            let color = NSColor(hue: CGFloat(hue), saturation: 0.7, brightness: 0.9, alpha: 1.0)
        #endif
        self.colorData = try? NSKeyedArchiver.archivedData(
            withRootObject: color, requiringSecureCoding: true)
    }
}

@Model
final class Game {
    var title: String?
    var isBinaryScore: Bool = false
    @Attribute private var _supportedPlayerCountsData: Data?
    @Relationship(deleteRule: .nullify) var matches: [Match]?

    var supportedPlayerCounts: Set<Int> {
        get {
            if let data = _supportedPlayerCountsData,
                let array = try? JSONDecoder().decode([Int].self, from: data)
            {
                return Set(array)
            }
            return []
        }
        set {
            _supportedPlayerCountsData = try? JSONEncoder().encode(Array(newValue))
        }
    }

    init(title: String, isBinaryScore: Bool, supportedPlayerCounts: Set<Int>) {
        self.title = title
        self.isBinaryScore = isBinaryScore
        self._supportedPlayerCountsData = try? JSONEncoder().encode(Array(supportedPlayerCounts))
        self.matches = []
    }
}

@Model
final class Match {
    @Relationship(deleteRule: .nullify) var game: Game?
    var date: Date = Date()
    @Relationship(deleteRule: .nullify) var players: [Player]?
    @Attribute private var _playerOrderData: Data?
    @Relationship(deleteRule: .nullify) var scores: [Score]?
    @Attribute var winnerID: String?

    private var playerOrder: [String] {
        get {
            if let data = _playerOrderData,
                let order = try? JSONDecoder().decode([String].self, from: data)
            {
                return order
            }
            return players?.map { "\($0.persistentModelID)" } ?? []
        }
        set {
            _playerOrderData = try? JSONEncoder().encode(newValue)
        }
    }

    var orderedPlayers: [Player] {
        guard let players = players else { return [] }
        let order = playerOrder
        return players.sorted { player1, player2 in
            let id1 = "\(player1.persistentModelID)"
            let id2 = "\(player2.persistentModelID)"
            let index1 = order.firstIndex(of: id1) ?? Int.max
            let index2 = order.firstIndex(of: id2) ?? Int.max
            return index1 < index2
        }
    }

    var winner: Player? {
        players?.first { "\($0.persistentModelID)" == winnerID }
    }

    init(game: Game? = nil, date: Date = Date()) {
        self.game = game
        self.date = date
        self.players = []
        self._playerOrderData = nil
        self.scores = []
        self.winnerID = nil
    }

    func addPlayer(_ player: Player) {
        if players == nil {
            players = []
        }
        if !players!.contains(player) {
            players!.append(player)
            let id = "\(player.persistentModelID)"
            if !playerOrder.contains(id) {
                playerOrder.append(id)
            }
        }
    }
}

@Model
final class Score {
    @Relationship(deleteRule: .nullify, inverse: \Player.scores) var player: Player?
    @Relationship(deleteRule: .nullify, inverse: \Match.scores) var match: Match?
    var points: Int = 0

    init(player: Player? = nil, match: Match? = nil, points: Int = 0) {
        self.player = player
        self.match = match
        self.points = points
    }
}
