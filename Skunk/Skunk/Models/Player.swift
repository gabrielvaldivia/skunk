import CloudKit
import CoreLocation
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
        var location: CLLocation?
        var lastLocationUpdate: Date?

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
            name: String, photoData: Data? = nil, appleUserID: String? = nil,
            ownerID: String? = nil,
            location: CLLocation? = nil
        ) {
            // Create a unique ID in the same format as CloudKit record IDs
            self.id = UUID().uuidString
            self.name = name
            self.photoData = photoData
            self.appleUserID = appleUserID
            self.ownerID = ownerID
            self.recordID = nil
            self.location = location
            self.lastLocationUpdate = location != nil ? Date() : nil

            // Generate color data
            let hash = abs(name.hashValue)
            let hue = Double(hash % 255) / 255.0
            let uiColor = UIColor(hue: CGFloat(hue), saturation: 0.7, brightness: 0.9, alpha: 1.0)
            self.colorData = try? NSKeyedArchiver.archivedData(
                withRootObject: uiColor, requiringSecureCoding: true)
        }

        init?(from record: CKRecord) {
            guard let name = record.value(forKey: "name") as? String else { return nil }
            guard let id = record.value(forKey: "id") as? String else { return nil }

            self.id = id
            self.name = name
            self.colorData = record.value(forKey: "colorData") as? Data
            self.appleUserID = record.value(forKey: "appleUserID") as? String
            self.ownerID = record.value(forKey: "ownerID") as? String
            self.record = record
            self.recordID = record.recordID
            self.location = record.value(forKey: "location") as? CLLocation
            self.lastLocationUpdate = record.value(forKey: "lastLocationUpdate") as? Date

            // Handle photo data from CKAsset
            if let photoAsset = record.value(forKey: "photo") as? CKAsset,
                let fileURL = photoAsset.fileURL
            {
                self.photoData = try? Data(contentsOf: fileURL)
            } else {
                self.photoData = nil
            }
        }

        func toRecord() -> CKRecord {
            let record: CKRecord
            if let existingRecordID = recordID {
                record = CKRecord(recordType: "Player", recordID: existingRecordID)
            } else {
                record = CKRecord(recordType: "Player")
            }

            record.setValue(id, forKey: "id")
            record.setValue(name, forKey: "name")
            record.setValue(colorData, forKey: "colorData")
            record.setValue(appleUserID, forKey: "appleUserID")
            record.setValue(ownerID, forKey: "ownerID")
            record.setValue(location, forKey: "location")
            record.setValue(lastLocationUpdate, forKey: "lastLocationUpdate")

            // Handle photo data as CKAsset
            if let photoData = photoData {
                let tempDir = FileManager.default.temporaryDirectory
                let fileName = UUID().uuidString + ".jpg"
                let fileURL = tempDir.appendingPathComponent(fileName)

                do {
                    try photoData.write(to: fileURL)
                    let asset = CKAsset(fileURL: fileURL)
                    record.setValue(asset, forKey: "photo")
                } catch {
                    print("Error creating photo asset: \(error)")
                }
            } else {
                record.setValue(nil, forKey: "photo")
            }

            return record
        }

        // Add a method to create an updated copy
        func updated(name: String? = nil, photoData: Data? = nil) -> Player {
            var updatedPlayer = self
            if let name = name {
                updatedPlayer.name = name
            }
            if let photoData = photoData {
                updatedPlayer.photoData = photoData
            }
            // Preserve the record and recordID
            updatedPlayer.record = self.record
            updatedPlayer.recordID = self.recordID
            return updatedPlayer
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
