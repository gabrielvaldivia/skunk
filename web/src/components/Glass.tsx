import type { ComponentProps } from "react";
import { Glass as LiquidGlass } from "@samasante/liquid-glass";
import { cn } from "@/lib/utils";

/**
 * Liquid glass surface for floating controls (@samasante/liquid-glass).
 * Frosts, tints and edge-lights everywhere; in Chrome/Edge it also bends the
 * page behind. Style and position it like a div; `style.background` is the tint.
 */
export function Glass({ className, style, optics, ...props }: ComponentProps<typeof LiquidGlass>) {
  return (
    <LiquidGlass
      className={cn("rounded-full text-foreground", className)}
      // A light veil of the page colour, so the tint follows light/dark mode
      style={{ background: "hsl(var(--background) / 0.22)", ...style }}
      optics={{ frost: 6, ...optics }}
      {...props}
    />
  );
}

/** A round glass icon button; `className` positions it (it's the outer box) */
export function GlassIconButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <div className={cn("size-12", className)}>
      <Glass className="size-full">
        <button
          type="button"
          className="flex size-full items-center justify-center rounded-full text-foreground transition-transform active:scale-95"
          {...props}
        >
          {children}
        </button>
      </Glass>
    </div>
  );
}
