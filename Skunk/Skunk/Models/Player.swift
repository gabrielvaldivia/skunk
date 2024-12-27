import CloudKit
import Foundation
import SwiftUI

#if canImport(UIKit)
    import UIKit

    struct Player: Identifiable, Hashable {
        let id: String
        var name: String
        var photoData: Data?
        var colorData: Data?
        var appleUserID: String?
        var ownerID: String?
        var record: CKRecord?
        var recordID: CKRecord.ID?

        var color: Color {
            if let colorData = colorData,
                let uiColor = try? NSKeyedUnarchiver.unarchivedObject(
                    ofClass: UIColor.self, from: colorData)
            {
                return Color(uiColor: uiColor)
            }
            // Generate a consistent color based on the name
            let hash = abs(name.hashValue)
            let hue = Double(hash % 255) / 255.0
            return Color(hue: hue, saturation: 0.7, brightness: 0.9)
        }

        init(
            name: String, photoData: Data? = nil, appleUserID: String? = nil, ownerID: String? = nil
        ) {
            self.id = UUID().uuidString
            self.name = name
            self.photoData = photoData
            self.appleUserID = appleUserID
            self.ownerID = ownerID
            self.recordID = nil

            // Generate color data
            let hash = abs(name.hashValue)
            let hue = Double(hash % 255) / 255.0
            let uiColor = UIColor(hue: CGFloat(hue), saturation: 0.7, brightness: 0.9, alpha: 1.0)
            self.colorData = try? NSKeyedArchiver.archivedData(
                withRootObject: uiColor, requiringSecureCoding: true)
        }

        init?(from record: CKRecord) {
            guard let name = record.value(forKey: "name") as? String else { return nil }

            self.id = UUID().uuidString
            self.name = name
            self.photoData = record.value(forKey: "photoData") as? Data
            self.colorData = record.value(forKey: "colorData") as? Data
            self.appleUserID = record.value(forKey: "appleUserID") as? String
            self.ownerID = record.value(forKey: "ownerID") as? String
            self.record = record
            self.recordID = record.recordID
        }

        func toRecord() -> CKRecord {
            let record: CKRecord
            if let existingRecordID = recordID {
                record = CKRecord(recordType: "Player", recordID: existingRecordID)
            } else {
                record = CKRecord(recordType: "Player")
            }

            record.setValue(name, forKey: "name")
            record.setValue(photoData, forKey: "photoData")
            record.setValue(colorData, forKey: "colorData")
            record.setValue(appleUserID, forKey: "appleUserID")
            record.setValue(ownerID, forKey: "ownerID")

            return record
        }

        // MARK: - Hashable

        func hash(into hasher: inout Hasher) {
            hasher.combine(id)
        }

        static func == (lhs: Player, rhs: Player) -> Bool {
            lhs.id == rhs.id
        }
    }
#endif
