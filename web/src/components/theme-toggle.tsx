import { MoonIcon, SunIcon, SystemIcon } from "./icons";
import { useTheme } from "./theme-provider"
import { cn } from "@/lib/utils"

const options = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "Auto", icon: SystemIcon },
] as const

// Segmented control for picking light / dark / system theme
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-full bg-secondary p-1">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-all",
            theme === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}
