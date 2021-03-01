//
//  SeasonView.swift
//  Skunk WatchKit Extension
//
//  Created by Gabriel Valdivia on 2/28/21.
//

import SwiftUI

struct SeasonView: View {
    var body: some View {
        
        ScrollView {
            VStack  (spacing: 10){
                
                // THIS SEASON'S CHAMP
                Group {
                    Text ("Season Champ")
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
                            Text ("12")
                                .font(.system(size: 30))
                            Text ("Gabe")
                                .font(.system(size: 10))
                                .textCase(.uppercase)
                                .opacity(0.5)
                        }
                        VStack {
                            Text ("8")
                                .font(.system(size: 30))
                            Text ("Claudio")
                                .font(.system(size: 10))
                                .textCase(.uppercase)
                                .opacity(0.5)
                        }
                    }
                }
                
                // NEW SESSION BUTTON
                NavigationLink(destination: SessionView()) {
                    HStack{
                        Image (systemName: "plus")
                        Text ("New Session")
                    }
                }
                
                // THIS SEASON'S SESSIONS
                    NavigationLink(destination: SeasonView()) {
                        HStack {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text ("Mar 23")
                                        .font(.system(size: 12))
                                        .textCase(.uppercase)
                                        .opacity(0.5)
                                    Text ("3 - 12")
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

struct SeasonView_Previews: PreviewProvider {
    static var previews: some View {
        SeasonView()
    }
}
}
