import { useCallback, useSyncExternalStore } from "react"

// Reads the current match synchronously so the first render is already correct
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const result = matchMedia(query)
      result.addEventListener("change", onChange)
      return () => result.removeEventListener("change", onChange)
    },
    [query]
  )
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches, () => false)
}
