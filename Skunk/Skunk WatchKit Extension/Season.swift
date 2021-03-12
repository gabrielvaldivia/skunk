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
    public var seasonPlayerWinner: String!
    public var seasonPlayerScores: [Int]!
    public var sessions: [String]!
    
    init(name: String!, game: String!, players: [String]!, seasonPlayerWinner: String!, seasonPlayerScores: [Int]!, sessions: [String]!) {
        self.id = UUID().uuidString
        self.name = name
        self.game = game
        self.players = players
        self.seasonPlayerWinner = seasonPlayerWinner
        self.seasonPlayerScores = seasonPlayerScores
        self.sessions = sessions
    }
}
