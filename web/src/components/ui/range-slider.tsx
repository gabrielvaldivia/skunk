import * as React from "react"
import { cn } from "@/lib/utils"

export interface RangeSliderProps {
  min?: number
  max?: number
  minValue: number
  maxValue: number
  onValueChange?: (values: { min: number; max: number }) => void
  className?: string
  step?: number
}

export function RangeSlider({
  min = 2,
  max = 10,
  minValue,
  maxValue,
  onValueChange,
  className,
  step = 1,
}: RangeSliderProps) {
  const [isDragging, setIsDragging] = React.useState<"min" | "max" | null>(null)
  const sliderRef = React.useRef<HTMLDivElement>(null)

  const getClientX = (e: MouseEvent | TouchEvent) => {
    if ("touches" in e) {
      return e.touches[0]?.clientX ?? 0
    }
    return e.clientX
  }

  const handleStart = (type: "min" | "max") => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(type)
  }

  const handleMove = React.useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !sliderRef.current) return

      const clientX = getClientX(e)
      const rect = sliderRef.current.getBoundingClientRect()
      const percentage = Math.max(
        0,
        Math.min(100, ((clientX - rect.left) / rect.width) * 100)
      )
      // Calculate value from percentage
      const rawValue = min + (percentage / 100) * (max - min)
      const steppedValue = Math.round(rawValue / step) * step
      const newValue = Math.max(min, Math.min(max, steppedValue))

      if (isDragging === "min") {
        const clampedValue = Math.min(newValue, maxValue - step)
        onValueChange?.({
          min: clampedValue,
          max: maxValue,
        })
      } else {
        const clampedValue = Math.max(newValue, minValue + step)
        onValueChange?.({
          min: minValue,
          max: clampedValue,
        })
      }
    },
    [isDragging, minValue, maxValue, min, max, step, onValueChange]
  )

  const handleEnd = React.useCallback(() => {
    setIsDragging(null)
  }, [])

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMove)
      document.addEventListener("mouseup", handleEnd)
      document.addEventListener("touchmove", handleMove, { passive: false })
      document.addEventListener("touchend", handleEnd)
      return () => {
        document.removeEventListener("mousemove", handleMove)
        document.removeEventListener("mouseup", handleEnd)
        document.removeEventListener("touchmove", handleMove)
        document.removeEventListener("touchend", handleEnd)
      }
    }
  }, [isDragging, handleMove, handleEnd])

  const minPercentage = ((minValue - min) / (max - min)) * 100
  const maxPercentage = ((maxValue - min) / (max - min)) * 100

  return (
    <div
      ref={sliderRef}
      className={cn("relative w-full h-6 flex items-center", className)}
    >
      {/* Track */}
      <div className="absolute w-full h-2 bg-input rounded-lg" />

      {/* Active range */}
      <div
        className="absolute h-2 bg-primary rounded-lg"
        style={{
          left: `${minPercentage}%`,
          width: `${maxPercentage - minPercentage}%`,
        }}
      />

      {/* Min handle */}
      <div
        className="absolute w-4 h-4 bg-primary rounded-full cursor-pointer shadow-lg z-10 -ml-2 touch-none"
        style={{ left: `${minPercentage}%` }}
        onMouseDown={handleStart("min")}
        onTouchStart={handleStart("min")}
      />

      {/* Max handle */}
      <div
        className="absolute w-4 h-4 bg-primary rounded-full cursor-pointer shadow-lg z-10 -ml-2 touch-none"
        style={{ left: `${maxPercentage}%` }}
        onMouseDown={handleStart("max")}
        onTouchStart={handleStart("max")}
      />
    </div>
  )
}

