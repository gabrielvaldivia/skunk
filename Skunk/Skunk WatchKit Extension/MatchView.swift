//
//  MatchView.swift
//  Skunk WatchKit Extension
//
//  Created by Gabriel Valdivia on 2/28/21.
//

import SwiftUI

struct MatchView: View {
    @State var scoreGabe = 1
    @State var scoreClaudio = 1
    
    var body: some View {
        VStack (spacing:10){
            Text ("Claudio Sux")
            HStack (spacing:10){
                Picker(selection: $scoreGabe, label: Text("Gabe")) {
                    Group {
                        /*@START_MENU_TOKEN@*/Text("1").tag(1)/*@END_MENU_TOKEN@*/
                        /*@START_MENU_TOKEN@*/Text("2").tag(2)/*@END_MENU_TOKEN@*/
                        Text("3").tag(3)
                        Text("4").tag(4)
                        Text("5").tag(5)
                        Text("6").tag(6)
                        Text("7").tag(7)
                        Text("8").tag(8)
                        Text("9").tag(9)
                        Text("10").tag(10)
                    }
                    Group {
                        Text("11").tag(11)
                        Text("12").tag(12)
                        Text("13").tag(13)
                        Text("14").tag(14)
                        Text("15").tag(15)
                        Text("16").tag(16)
                        Text("17").tag(17)
                        Text("18").tag(18)
                        Text("19").tag(19)
                        Text("20").tag(20)
                    }
                    Group {
                        Text("21").tag(21)
                        Text("22").tag(22)
                        Text("23").tag(23)
                        Text("24").tag(24)
                        Text("25").tag(25)
                        Text("26").tag(26)
                        Text("27").tag(27)
                        Text("28").tag(28)
                        Text("29").tag(29)
                        Text("30").tag(30)
                    }
                }
                
                Picker(selection: $scoreClaudio, label: Text("Claudio")) {
                    Group {
                        /*@START_MENU_TOKEN@*/Text("1").tag(1)/*@END_MENU_TOKEN@*/
                        /*@START_MENU_TOKEN@*/Text("2").tag(2)/*@END_MENU_TOKEN@*/
                        Text("3").tag(3)
                        Text("4").tag(4)
                        Text("5").tag(5)
                        Text("6").tag(6)
                        Text("7").tag(7)
                        Text("8").tag(8)
                        Text("9").tag(9)
                        Text("10").tag(10)
                    }
                    Group {
                        Text("11").tag(11)
                        Text("12").tag(12)
                        Text("13").tag(13)
                        Text("14").tag(14)
                        Text("15").tag(15)
                        Text("16").tag(16)
                        Text("17").tag(17)
                        Text("18").tag(18)
                        Text("19").tag(19)
                        Text("20").tag(20)
                    }
                    Group {
                        Text("21").tag(21)
                        Text("22").tag(22)
                        Text("23").tag(23)
                        Text("24").tag(24)
                        Text("25").tag(25)
                        Text("26").tag(26)
                        Text("27").tag(27)
                        Text("28").tag(28)
                        Text("29").tag(29)
                        Text("30").tag(30)
                    }
                }
            }
            Button ("Save", action: {
                print("Hello world")
            }
            )
        }
    }
}

struct MatchView_Previews: PreviewProvider {
    static var previews: some View {
        MatchView()
    }
}
