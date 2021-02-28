//
//  SkunkApp.swift
//  Skunk WatchKit Extension
//
//  Created by Gabriel Valdivia on 2/28/21.
//

import SwiftUI

@main
struct SkunkApp: App {
    @SceneBuilder var body: some Scene {
        WindowGroup {
            NavigationView {
                ContentView()
            }
        }

        WKNotificationScene(controller: NotificationController.self, category: "myCategory")
    }
}
