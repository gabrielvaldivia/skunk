import SwiftUI

struct PlayerInitialsView: View {
    let name: String
    let size: CGFloat
    let color: Color

    private var initials: String {
        let components = name.components(separatedBy: CharacterSet.whitespaces)
        if components.count > 1,
            let first = components.first?.first,
            let last = components.last?.first
        {
            return "\(first)\(last)".uppercased()
        } else if let first = name.first {
            return String(first).uppercased()
        }
        return "?"
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(color)

            Text(initials)
                .font(.system(size: size * 0.4, weight: .bold))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    VStack {
        PlayerInitialsView(name: "John Doe", size: 100, color: .blue)
        PlayerInitialsView(name: "Alice", size: 60, color: .red)
        PlayerInitialsView(name: "", size: 40, color: .green)
    }
}
