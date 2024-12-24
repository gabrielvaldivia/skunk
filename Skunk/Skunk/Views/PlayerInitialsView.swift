import SwiftUI

struct PlayerInitialsView: View {
    let name: String
    let size: CGFloat

    private var initial: String {
        String(name.prefix(1).uppercased())
    }

    private var color: Color {
        // Generate a consistent color based on the name
        let hash = abs(name.hashValue)
        let hue = Double(hash % 255) / 255.0  // Use hash to get consistent hue
        return Color(hue: hue, saturation: 0.8, brightness: 0.7)  // High saturation, slightly dark
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
        PlayerInitialsView(name: "John Doe", size: 40)
        PlayerInitialsView(name: "Alice Smith", size: 60)
        PlayerInitialsView(name: "Bob Wilson", size: 80)
    }
}
