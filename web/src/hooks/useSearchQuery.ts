import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// Search text kept in the URL (?q=), so it survives switching views and reloads
export function useSearchQuery() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const setQuery = useCallback(
    (q: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (q) next.set("q", q);
          else next.delete("q");
          return next;
        },
        { replace: true }
      ),
    [setParams]
  );
  return [query, setQuery] as const;
}
