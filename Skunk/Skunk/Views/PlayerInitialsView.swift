import SwiftUI

struct PlayerInitialsView: View {
    let name: String
    let size: CGFloat
    let color: Color

    private var initials: String {
        let components = name.components(separatedBy: .whitespaces)
        if components.count > 1 {
            return String(components[0].prefix(1) + components[1].prefix(1))
        } else {
            return String(name.prefix(2))
        }
    }

    init(name: String, size: CGFloat, color: Color? = nil) {
        self.name = name
        self.size = size
        if let color = color {
            self.color = color
        } else {
            // Generate a consistent color based on the name
            let hash = abs(name.hashValue)
            let hue = Double(hash % 255) / 255.0
            self.color = Color(hue: hue, saturation: 0.7, brightness: 0.9)
        }
    }

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .overlay {
                Text(initials.uppercased())
                    .font(.system(size: size * 0.4, weight: .bold))
                    .foregroundStyle(.white)
            }
    }
}
