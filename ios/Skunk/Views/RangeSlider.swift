#if canImport(UIKit)
    import SwiftUI

    struct RangeSlider: View {
        @Binding var minValue: Int
        @Binding var maxValue: Int
        let range: ClosedRange<Int>
        let step: Int

        init(
            minValue: Binding<Int>,
            maxValue: Binding<Int>,
            in range: ClosedRange<Int>,
            step: Int = 1
        ) {
            self._minValue = minValue
            self._maxValue = maxValue
            self.range = range
            self.step = step
        }

        var body: some View {
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Track
                    Rectangle()
                        .fill(Color(.systemGray5))
                        .frame(height: 4)
                        .cornerRadius(2)

                    // Active range
                    Rectangle()
                        .fill(Color.accentColor)
                        .frame(height: 4)
                        .cornerRadius(2)
                        .offset(x: CGFloat(positionForValue(minValue, in: geometry.size.width)))
                        .frame(
                            width: CGFloat(
                                positionForValue(maxValue, in: geometry.size.width)
                                    - positionForValue(minValue, in: geometry.size.width)
                            )
                        )

                    // Min handle
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 20, height: 20)
                        .shadow(radius: 2)
                        .offset(x: CGFloat(positionForValue(minValue, in: geometry.size.width)) - 10)
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    let newValue = valueForPosition(
                                        value.location.x, in: geometry.size.width
                                    )
                                    let clampedValue = min(
                                        newValue, maxValue - step
                                    )
                                    minValue = clampedValue
                                }
                        )

                    // Max handle
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 20, height: 20)
                        .shadow(radius: 2)
                        .offset(x: CGFloat(positionForValue(maxValue, in: geometry.size.width)) - 10)
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    let newValue = valueForPosition(
                                        value.location.x, in: geometry.size.width
                                    )
                                    let clampedValue = max(
                                        newValue, minValue + step
                                    )
                                    maxValue = clampedValue
                                }
                        )
                }
            }
            .frame(height: 20)
        }

        private func positionForValue(_ value: Int, in width: CGFloat) -> CGFloat {
            let rangeSize = CGFloat(range.upperBound - range.lowerBound)
            let valuePosition = CGFloat(value - range.lowerBound)
            return (valuePosition / rangeSize) * width
        }

        private func valueForPosition(_ position: CGFloat, in width: CGFloat) -> Int {
            let rangeSize = CGFloat(range.upperBound - range.lowerBound)
            let percentage = max(0, min(1, position / width))
            let rawValue = CGFloat(range.lowerBound) + percentage * rangeSize
            let steppedValue = Int((rawValue / CGFloat(step)).rounded()) * step
            return max(range.lowerBound, min(range.upperBound, steppedValue))
        }
    }
#endif

