//
//  Match.swift
//  Skunk WatchKit Extension
//
//  Created by Claudio Vallejo on 3/11/21.
//

import Foundation

struct Match: Hashable, Identifiable {
    public var id: String
    public var date: Date!
    public var session: String!
    public var players: [String]!
    public var matchPlayerScores: [Int]!
    public var matchPlayerWinner: String!
}
