import SwiftUI
import UIKit

struct PlayerInitialsView: View {
    let name: String
    let size: CGFloat
    let colorData: Data?

    private var initial: String {
        String(name.prefix(1).uppercased())
    }

    private var color: Color {
        if let colorData = colorData,
            let uiColor = try? NSKeyedUnarchiver.unarchivedObject(
                ofClass: UIColor.self, from: colorData)
        {
            return Color(uiColor: uiColor)
        } else {
            // Fallback color for preview or if color is not set
            return Color(hue: 0.5, saturation: 0.8, brightness: 0.7)
        }
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(color)
            Text(initial)
                .font(.system(size: size * 0.4, weight: .bold))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
    }
}
