import SwiftUI

struct PlayerInitialsView: View {
    let name: String
    let size: CGFloat
    let colorHue: Double?

    private var initial: String {
        String(name.prefix(1).uppercased())
    }

    private var color: Color {
        if let hue = colorHue {
            return Color(hue: hue, saturation: 0.8, brightness: 0.7)
        } else {
            // Fallback color for preview or if hue is not set
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
        PlayerInitialsView(name: "John Doe", size: 40, colorHue: 0.1)
        PlayerInitialsView(name: "Alice Smith", size: 60, colorHue: 0.3)
        PlayerInitialsView(name: "Bob Wilson", size: 80, colorHue: 0.6)
    }
}
