//
//  Season.swift
//  Skunk WatchKit Extension
//
//  Created by Claudio Vallejo on 3/9/21.
//

import Foundation

struct Season: Hashable, Identifiable {
    public var id: String
    public var name: String!
    public var game: String!
    public var players: [String]!
    public var seasonChamp: String!
    public var seasonPlayerScores: [Int]!
    public var sessions: [String]!
    
    init(name: String!, game: String!, players: [String]!, seasonChamp: String!, seasonPlayerScores: [Int]!, sessions: [String]!) {
        self.id = UUID().uuidString
        self.name = name
        self.game = game
        self.players = players
        self.seasonChamp = seasonChamp
        self.seasonPlayerScores = seasonPlayerScores
        self.sessions = sessions
    }
}
