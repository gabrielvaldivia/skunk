import Foundation
import SwiftData

@Model
class Player {
    var name: String
    var photoData: Data?
    @Relationship(deleteRule: .cascade) var matches: [Match]
    @Relationship(deleteRule: .cascade) var tournaments: [Tournament]

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
    @Relationship(deleteRule: .cascade) var matches: [Match]
    @Relationship(deleteRule: .cascade) var tournaments: [Tournament]

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
    @Relationship(inverse: \Game.matches) var game: Game?
    @Relationship var tournament: Tournament?
    var date: Date
    @Relationship(inverse: \Player.matches) var players: [Player]
    @Relationship(deleteRule: .cascade) var scores: [Score]
    @Attribute var winnerID: String?

    var winner: Player? {
        players.first { "\($0.persistentModelID)" == winnerID }
    }

    init(game: Game? = nil, tournament: Tournament? = nil, date: Date = Date()) {
        self.game = game
        self.tournament = tournament
        self.date = date
        self.players = []
        self.scores = []
        self.winnerID = nil
    }
}

@Model
class Tournament {
    @Relationship(inverse: \Game.tournaments) var game: Game?
    var name: String
    var date: Date
    @Relationship(deleteRule: .cascade, inverse: \Match.tournament) var matches: [Match]
    @Relationship(inverse: \Player.tournaments) var players: [Player]
    @Attribute var winnerID: String?

    var winner: Player? {
        players.first { "\($0.persistentModelID)" == winnerID }
    }

    init(game: Game? = nil, name: String, date: Date = Date()) {
        self.game = game
        self.name = name
        self.date = date
        self.matches = []
        self.players = []
        self.winnerID = nil
    }
}

@Model
class Score {
    @Relationship(inverse: \Match.scores) var match: Match?
    @Relationship var player: Player?
    var points: Int

    init(player: Player? = nil, match: Match? = nil, points: Int) {
        self.player = player
        self.match = match
        self.points = points
    }
}
