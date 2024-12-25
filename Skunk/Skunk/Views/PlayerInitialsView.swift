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

#Preview {
    VStack {
        let color1 = UIColor(hue: 0.1, saturation: 0.8, brightness: 0.7, alpha: 1.0)
        let color2 = UIColor(hue: 0.3, saturation: 0.8, brightness: 0.7, alpha: 1.0)
        let color3 = UIColor(hue: 0.6, saturation: 0.8, brightness: 0.7, alpha: 1.0)

        PlayerInitialsView(
            name: "John Doe",
            size: 40,
            colorData: try? NSKeyedArchiver.archivedData(
                withRootObject: color1, requiringSecureCoding: true)
        )
        PlayerInitialsView(
            name: "Alice Smith",
            size: 60,
            colorData: try? NSKeyedArchiver.archivedData(
                withRootObject: color2, requiringSecureCoding: true)
        )
        PlayerInitialsView(
            name: "Bob Wilson",
            size: 80,
            colorData: try? NSKeyedArchiver.archivedData(
                withRootObject: color3, requiringSecureCoding: true)
        )
    }
}
