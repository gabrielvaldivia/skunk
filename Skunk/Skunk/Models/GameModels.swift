import Foundation
import SwiftData

@Model
class Player {
    var name: String
    var photoData: Data?
    var matches: [Match]
    var tournaments: [Tournament]

    init(name: String, photoData: Data? = nil) {
        self.name = name
        self.photoData = photoData
        self.matches = []
        self.tournaments = []
    }
}

@Model
class Game {
    var title: String
    var isBinaryScore: Bool  // true for win/lose, false for point-based
    @Attribute private var _supportedPlayerCountsData: Data?
    var matches: [Match]
    var tournaments: [Tournament]

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
        self.tournaments = []
    }
}

@Model
class Match {
    var game: Game?
    var tournament: Tournament?
    var date: Date
    var players: [Player]
    var scores: [Score]
    var winner: Player?

    init(game: Game? = nil, tournament: Tournament? = nil, date: Date = Date()) {
        self.game = game
        self.tournament = tournament
        self.date = date
        self.players = []
        self.scores = []
    }
}

@Model
class Tournament {
    var game: Game?
    var name: String
    var date: Date
    var matches: [Match]
    var players: [Player]
    var winner: Player?

    init(game: Game? = nil, name: String, date: Date = Date()) {
        self.game = game
        self.name = name
        self.date = date
        self.matches = []
        self.players = []
    }
}

@Model
class Score {
    var player: Player?
    var match: Match?
    var points: Int

    init(player: Player? = nil, match: Match? = nil, points: Int) {
        self.player = player
        self.match = match
        self.points = points
    }
}
