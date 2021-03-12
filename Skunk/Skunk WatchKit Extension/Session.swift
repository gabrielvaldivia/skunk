//
//  Session.swift
//  Skunk WatchKit Extension
//
//  Created by Claudio Vallejo on 3/11/21.
//

import Foundation

struct Session: Hashable, Identifiable {
    public var id: String
    public var date: Date!
    public var season: String!
    public var players: [String]!
    public var matches: [String]!
    public var sessionPlayerScores: [Int]!
    public var sessionPlayerChamp: String
    
    init(date: Date!, season: String!, players: [String]!, matches: [String]!, sessionPlayerScores: [Int]!, sessionPlayerChamp: String) {
        self.id = UUID().uuidString
        self.date = date
        self.season = season
        self.players = players
        self.matches = matches
        self.sessionPlayerScores = sessionPlayerScores
        self.sessionPlayerChamp = sessionPlayerChamp
    }
}
