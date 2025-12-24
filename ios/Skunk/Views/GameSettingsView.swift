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
        @Binding var isTeamBased: Bool
        @Binding var minPlayers: Int
        @Binding var maxPlayers: Int
        @Binding var hasMax: Bool
        @Binding var countAllScores: Bool
        @Binding var countLosersOnly: Bool
        @Binding var highestScoreWins: Bool
        @Binding var highestRoundScoreWins: Bool
        @Binding var trackRounds: Bool
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

                Section("Player Count") {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Player Count")
                            Spacer()
                            if hasMax {
                                HStack(spacing: 4) {
                                    TextField("", text: Binding(
                                        get: { String(minPlayers) },
                                        set: { newValue in
                                            if let intValue = Int(newValue), intValue >= 2 {
                                                minPlayers = intValue
                                                if intValue > maxPlayers {
                                                    maxPlayers = intValue
                                                }
                                            }
                                        }
                                    ))
                                    .textFieldStyle(.roundedBorder)
                                    .frame(width: 50)
                                    .keyboardType(.numberPad)
                                    
                                    Text("-")
                                        .foregroundColor(.secondary)
                                    
                                    ZStack(alignment: .trailing) {
                                        TextField("", text: Binding(
                                            get: { String(maxPlayers) },
                                            set: { newValue in
                                                if let intValue = Int(newValue), intValue >= minPlayers {
                                                    maxPlayers = intValue
                                                }
                                            }
                                        ))
                                        .textFieldStyle(.roundedBorder)
                                        .frame(width: 50)
                                        .keyboardType(.numberPad)
                                        .padding(.trailing, 20)
                                        
                                        Button(action: {
                                            maxPlayers = minPlayers
                                            hasMax = false
                                        }) {
                                            Image(systemName: "xmark")
                                                .font(.system(size: 10))
                                                .foregroundColor(.secondary)
                                                .padding(4)
                                        }
                                        .offset(x: -4)
                                    }
                                }
                            } else {
                                HStack(spacing: 4) {
                                    TextField("", text: Binding(
                                        get: { String(minPlayers) },
                                        set: { newValue in
                                            if let intValue = Int(newValue), intValue >= 2 {
                                                minPlayers = intValue
                                                maxPlayers = intValue
                                            }
                                        }
                                    ))
                                    .textFieldStyle(.roundedBorder)
                                    .frame(width: 50)
                                    .keyboardType(.numberPad)
                                    
                                    Button(action: {
                                        maxPlayers = minPlayers + 2
                                        hasMax = true
                                    }) {
                                        Text("Add max")
                                            .font(.subheadline)
                                            .foregroundColor(.blue)
                                    }
                                }
                            }
                        }
                        if hasMax {
                            let sliderMax = max(10, minPlayers, maxPlayers)
                            RangeSlider(
                                minValue: $minPlayers,
                                maxValue: $maxPlayers,
                                in: 2...sliderMax,
                                step: 1
                            )
                        } else {
                            let sliderMax = max(10, minPlayers)
                            Slider(
                                value: Binding(
                                    get: { Double(minPlayers) },
                                    set: { newValue in
                                        let intValue = Int(newValue.rounded())
                                        minPlayers = intValue
                                        maxPlayers = intValue
                                    }
                                ),
                                in: 2.0...Double(sliderMax),
                                step: 1.0
                            )
                        }
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
                    
                    Toggle(
                        "Team-Based Game",
                        isOn: $isTeamBased
                    )
                    .toggleStyle(.switch)
                }

                if !isBinaryScore {
                    Section("Match Winning Condition") {
                        RadioButton(
                            title: "Highest Total Score",
                            isSelected: highestScoreWins
                        ) {
                            highestScoreWins = true
                        }

                        RadioButton(
                            title: "Lowest Total Score",
                            isSelected: !highestScoreWins
                        ) {
                            highestScoreWins = false
                        }
                    }

                    Section("Game Rules") {
                        Toggle(
                            "Track Rounds",
                            isOn: $trackRounds
                        )
                        .toggleStyle(.switch)
                    }

                    if trackRounds {
                        Section("Round Winning Condition") {
                            RadioButton(
                                title: "Highest Score",
                                isSelected: highestRoundScoreWins
                            ) {
                                highestRoundScoreWins = true
                            }

                            RadioButton(
                                title: "Lowest Score",
                                isSelected: !highestRoundScoreWins
                            ) {
                                highestRoundScoreWins = false
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
