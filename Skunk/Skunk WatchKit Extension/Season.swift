//
//  Season.swift
//  Skunk WatchKit Extension
//
//  Created by Claudio Vallejo on 3/9/21.
//

import Foundation

struct Season: Hashable, Identifiable {
    public var id: String
    public var name: String?
    public var gameId: String!
    public var totalMatches: Int!
    public var seasonChamp: Player?
    public var players: [String]!
    public var sessions: [Session]!
}

init(name: String, gameId: String, totalMatches: Int, seasonChamp: Player, playerIds: [String], sessions: []) {
    self.id = UUID().uuidString
    self.name = name
    self.gameId = gameId
    self.totalMatches = totalMatches
}
