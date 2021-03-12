//
//  ProfileImage.swift
//  Skunk WatchKit Extension
//
//  Created by Claudio Vallejo on 3/11/21.
//

import SwiftUI
import struct Kingfisher.KFImage

struct ProfileImage: View {
    var url: String
    var size: CGFloat
    
    var body: some View {
        KFImage(URL(string: self.url))
            .resizable()
            .scaledToFill()
            .frame(width: self.size, height: self.size)
            .border(Color.gray, width: /*@START_MENU_TOKEN@*/1/*@END_MENU_TOKEN@*/)
            .clipShape(Circle())
    }
}

struct ProfileImage_Previews: PreviewProvider {
    static var previews: some View {
        ProfileImage(url: "https://firebasestorage.googleapis.com/v0/b/skunk-baf1d.appspot.com/o/gabriel-valdivia.jpg?alt=media&token=0a69299f-47d4-4ce9-ad62-8f31ff7c2d1c", size: 100)
    }
}
