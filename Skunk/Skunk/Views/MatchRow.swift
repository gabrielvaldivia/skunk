import SwiftData
import SwiftUI

#if canImport(UIKit)
    import UIKit
#else
    import AppKit
#endif

struct MatchRow: View {
    let match: Match
    let showGameTitle: Bool
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.self) private var environment
    @Environment(\.modelContext) private var modelContext

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d 'at' h:mm a"
        return formatter
    }()

    init(match: Match, showGameTitle: Bool = true) {
        self.match = match
        self.showGameTitle = showGameTitle
    }

    private var backgroundColor: Color {
        #if canImport(UIKit)
            Color(
                uiColor: environment.colorScheme == .dark
                    ? .secondarySystemGroupedBackground : .systemGroupedBackground)
        #else
            environment.colorScheme == .dark
                ? Color(.windowBackgroundColor) : Color(.controlBackgroundColor)
        #endif
    }

    var body: some View {
        NavigationLink(destination: MatchDetailView(match: match)) {
            HStack {
                VStack(alignment: .leading) {
                    if showGameTitle, let game = match.game {
                        Text(game.title ?? "")
                            .font(.body)
                        Text(Self.dateFormatter.string(from: match.date))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text(Self.dateFormatter.string(from: match.date))
                            .font(showGameTitle ? .caption : .body)
                            .foregroundStyle(showGameTitle ? .secondary : .primary)
                    }
                }

                Spacer()

                // Player photos
                if let winner = match.orderedPlayers.first(where: {
                    "\($0.persistentModelID)" == match.winnerID
                }) {
                    Group {
                        if let photoData = winner.photoData {
                            #if canImport(UIKit)
                                if let uiImage = UIImage(data: photoData) {
                                    Image(uiImage: uiImage)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 32, height: 32)
                                        .clipShape(Circle())
                                }
                            #else
                                if let nsImage = NSImage(data: photoData) {
                                    Image(nsImage: nsImage)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 32, height: 32)
                                        .clipShape(Circle())
                                }
                            #endif
                        } else {
                            PlayerInitialsView(
                                name: winner.name ?? "",
                                size: 32,
                                colorData: winner.colorData)
                        }
                    }
                }
            }
        }
    }
}
