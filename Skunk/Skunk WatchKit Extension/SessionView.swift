//
//  SessionView.swift
//  Skunk WatchKit Extension
//
//  Created by Gabriel Valdivia on 2/28/21.
//

import SwiftUI

struct SessionView: View {
    var body: some View {
        
        ScrollView {
            VStack  (spacing: 10){
                
                // THIS SESSION'S CHAMP
                Group {
                    Text ("Session Champ")
                        .font(.system(size: 12))
                        .textCase(.uppercase)
                        .opacity(0.5)
                    Image ("gabe")
                        .resizable()
                        .aspectRatio(contentMode: /*@START_MENU_TOKEN@*/.fill/*@END_MENU_TOKEN@*/)
                        .frame(width: 50, height: 50)
                        .clipShape(Circle())
                    HStack (spacing:30) {
                        VStack {
                            Text ("2")
                                .font(.system(size: 30))
                            Text ("Gabe")
                                .font(.system(size: 10))
                                .textCase(.uppercase)
                                .opacity(0.5)
                        }
                        VStack {
                            Text ("1")
                                .font(.system(size: 30))
                            Text ("Claudio")
                                .font(.system(size: 10))
                                .textCase(.uppercase)
                                .opacity(0.5)
                        }
                    }
                }
                
                // NEW MATCH BUTTON
                NavigationLink(destination: MatchView()) {
                    HStack{
                        Image (systemName: "plus")
                        Text ("New Match")
                    }
                }
                
                // THIS SESSION'S MATCHES
                    NavigationLink(destination: SeasonView()) {
                        HStack {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text ("Match 1")
                                        .font(.system(size: 12))
                                        .textCase(.uppercase)
                                        .opacity(0.5)
                                    Text ("21 - 18")
                                        .font(.system(size: 20))
                                }.frame(maxWidth: .infinity, alignment: .leading)
                                Image ("gabe")
                                    .resizable()
                                    .aspectRatio(contentMode: /*@START_MENU_TOKEN@*/.fill/*@END_MENU_TOKEN@*/)
                                    .frame(width: 30, height: 30)
                                    .clipShape(Circle())
                            }
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
}
