#if canImport(UIKit)
    import SwiftUI

    enum ScoreCountingMode {
        case all
        case winnerOnly
        case losersOnly
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

                    if !isBinaryScore {

                        Picker("Winning Condition", selection: $highestScoreWins) {
                            Text("Highest Score Wins").tag(true)
                            Text("Lowest Score Wins").tag(false)
                        }

                        Picker("Total Score Calculation", selection: scoreCountingMode) {
                            Text("All Players").tag(ScoreCountingMode.all)
                            Text("Winner Only").tag(ScoreCountingMode.winnerOnly)
                            Text("Add Loser's Score to Winner").tag(ScoreCountingMode.losersOnly)
                        }

                    }

                    Toggle("Multiple Rounds", isOn: $supportsMultipleRounds)
                        .toggleStyle(.switch)
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
