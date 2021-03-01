//
//  SeasonView.swift
//  Skunk WatchKit Extension
//
//  Created by Gabriel Valdivia on 2/28/21.
//

import SwiftUI

struct SeasonView: View {
    var body: some View {
        
        VStack {
            Text ("Season View")
            NavigationLink(destination: SessionView()) {
                        HStack{
                            Image (systemName: "plus")
                            Text ("New Session")
                        }
                    }
        }
        
    }
}

struct SeasonView_Previews: PreviewProvider {
    static var previews: some View {
        SeasonView()
    }
}
