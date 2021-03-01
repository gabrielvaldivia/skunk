//
//  SessionView.swift
//  Skunk WatchKit Extension
//
//  Created by Gabriel Valdivia on 2/28/21.
//

import SwiftUI

struct SessionView: View {
    var body: some View {
        VStack {
            Text("Session View")
            NavigationLink(destination: MatchView()) {
                HStack{
                    Image (systemName: "plus")
                    Text ("New Match")
                }
            }
        }
    }
}

struct SessionView_Previews: PreviewProvider {
    static var previews: some View {
        SessionView()
    }
}
