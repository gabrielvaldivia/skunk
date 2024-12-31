#if canImport(UIKit)
    import SwiftUI

    enum ScoreCountingMode {
        case all
        case winnerOnly
        case losersOnly
    }

    struct RadioButton: View {
        let title: String
        let isSelected: Bool
        let action: () -> Void

        var body: some View {
            Button(action: action) {
                HStack {
                    Text(title)
                        .foregroundColor(.primary)
                    Spacer()
                    Image(systemName: isSelected ? "checkmark" : "")
                        .foregroundColor(.blue)
                }
            }
        }
    }

    struct GameSettingsView: View {
        @Binding var title: String
        @Binding var isBinaryScore: Bool
        @Binding var supportsMultipleRounds: Bool
        @Binding var minPlayers: Int
        @Binding var maxPlayers: Int
        @Binding var countAllScores: Bool
        @Binding var countLosersOnly: Bool
        @Binding var highestScoreWins: Bool
        @FocusState private var isTitleFocused: Bool
        var showTitle: Bool = true
        var autofocusTitle: Bool = false

        private var scoreCountingMode: Binding<ScoreCountingMode> {
            Binding(
                get: {
                    if countAllScores {
                        return .all
                    } else if countLosersOnly {
                        return .losersOnly
                    } else {
                        return .winnerOnly
                    }
                },
                set: { newValue in
                    switch newValue {
                    case .all:
                        countAllScores = true
                        countLosersOnly = false
                    case .winnerOnly:
                        countAllScores = false
                        countLosersOnly = false
                    case .losersOnly:
                        countAllScores = false
                        countLosersOnly = true
                    }
                }
            )
        }

        var body: some View {
            Group {
                if showTitle {
                    Section {
                        TextField("Game Title", text: $title)
                            .focused($isTitleFocused)
                    }
                }

                Section("Game Rules") {
                    Toggle(
                        "Track Score",
                        isOn: Binding(
                            get: { !isBinaryScore },
                            set: { isBinaryScore = !$0 }
                        )
                    )
                    .toggleStyle(.switch)

                    Toggle("Multiple Rounds", isOn: $supportsMultipleRounds)
                        .toggleStyle(.switch)
                }

                if !isBinaryScore {
                    Section("Winning Condition") {
                        RadioButton(
                            title: "Highest Score Wins",
                            isSelected: highestScoreWins
                        ) {
                            highestScoreWins = true
                        }

                        RadioButton(
                            title: "Lowest Score Wins",
                            isSelected: !highestScoreWins
                        ) {
                            highestScoreWins = false
                        }
                    }

                    Section("Total Score Calculation") {
                        RadioButton(
                            title: "All Players' Scores Count",
                            isSelected: scoreCountingMode.wrappedValue == .all
                        ) {
                            scoreCountingMode.wrappedValue = .all
                        }

                        RadioButton(
                            title: "Only Winner's Score Counts",
                            isSelected: scoreCountingMode.wrappedValue == .winnerOnly
                        ) {
                            scoreCountingMode.wrappedValue = .winnerOnly
                        }

                        RadioButton(
                            title: "Winner Gets Sum of Losers' Scores",
                            isSelected: scoreCountingMode.wrappedValue == .losersOnly
                        ) {
                            scoreCountingMode.wrappedValue = .losersOnly
                        }
                    }
                }

                Section("Player Count") {
                    Stepper(
                        "Minimum \(minPlayers) Players", value: $minPlayers, in: 1...maxPlayers)
                    Stepper(
                        "Maximum \(maxPlayers) Players", value: $maxPlayers, in: minPlayers...99
                    )
                }
            }
            .onAppear {
                if autofocusTitle {
                    isTitleFocused = true
                }
            }
        }
    }
#endif
