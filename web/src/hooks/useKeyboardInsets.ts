import { useEffect } from "react";

/**
 * Tracks the on-screen keyboard via the Visual Viewport API and exposes it as
 * CSS variables on <html>:
 * - --vv-top: how far iOS has panned the page up to show a focused field
 * - --kb: the keyboard's height, measured up from the bottom of the screen
 * Pages shift back down by --vv-top (so their top stays in view), and bottom
 * controls inside them lift by --kb (so they sit just above the keyboard).
 */
export function useKeyboardInsets() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const top = Math.max(0, vv.offsetTop);
      const kb = Math.max(0, window.innerHeight - vv.height);
      root.style.setProperty("--vv-top", `${top}px`);
      root.style.setProperty("--kb", `${kb}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--vv-top");
      root.style.removeProperty("--kb");
    };
  }, []);
}
