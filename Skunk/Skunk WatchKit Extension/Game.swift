//
//  Game.swift
//  Skunk WatchKit Extension
//
//  Created by Claudio Vallejo on 3/11/21.
//

import Foundation

struct Game: Hashable, Identifiable {
    public var id: String
    public var name: String!
    public var seasons: [String]!
    public var matchScoringType: String!
    public var matchWinningPoints: Int!
    public var playersPerMatch: Int!
    
    init(name: String!, seasons: [String]!, matchScoringType: String!, matchWinningPoints: Int!, playersPerMatch: Int!) {
        self.id = UUID().uuidString
        self.name = name
        self.seasons = seasons
        self.matchScoringType = matchScoringType
        self.matchWinningPoints = matchWinningPoints
        self.playersPerMatch = playersPerMatch
    }
}
