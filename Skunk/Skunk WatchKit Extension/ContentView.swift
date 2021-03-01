//
//  ContentView.swift
//  Skunk WatchKit Extension
//
//  Created by Gabriel Valdivia on 2/28/21.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack {
            NavigationLink(destination: SeasonView()) {
                HStack{
                    Image (systemName: "plus")
                    Text ("New Season")
                }
            }
            List {
                NavigationLink(destination: SeasonView()) {
                    HStack {
                        HStack {
                            VStack(alignment: .leading) {
                                Text ("Spring")
                                    .font(.system(size: 12))
                                    .textCase(.uppercase)
                                    .opacity(0.5)
                                Text ("3/12")
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
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
