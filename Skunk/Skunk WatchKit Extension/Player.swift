//
//  Player.swift
//  Skunk WatchKit Extension
//
//  Created by Claudio Vallejo on 3/9/21.
//

import Foundation

struct Player: Hashable, Identifiable {
    public var id: String
    public var name: String!
    public var imageUrl: String!
    
    init(name: String!, imageUrl: String!) {
        self.id = UUID().uuidString
        self.name = name
        self.imageUrl = imageUrl
    }
}
