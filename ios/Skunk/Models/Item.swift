//
//  Item.swift
//  Skunk
//
//  Created by Gabriel Valdivia on 12/24/24.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
