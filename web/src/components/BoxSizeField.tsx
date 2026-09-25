import { useState } from "react";
import type { BoxDims, Game } from "../models/Game";
import { BOX_PRESETS, presetFor, resolveBoxDims, shelfBoxFor } from "@/lib/boxDimensions";
import { useCoverAspect } from "../hooks/useCoverAspects";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "flex px-3 py-2 w-full h-10 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const fmt = (n: number) => Number(n.toFixed(2)).toString();

function describe(dims: BoxDims) {
  const box = shelfBoxFor({ boxDims: dims } as Game);
  return `${fmt(box.width)} × ${fmt(box.height)} × ${fmt(box.depth)} in`;
}

interface BoxSizeFieldProps {
  game: Game;
  /** Cover currently in the form, which may differ from the saved one */
  coverArt?: string;
  value: BoxDims | null;
  onChange: (dims: BoxDims | null) => void;
}

/** Box size for the 3D shelf: automatic (from the cover's shape), a preset, or custom */
export function BoxSizeField({ game, coverArt, value, onChange }: BoxSizeFieldProps) {
  const aspect = useCoverAspect(coverArt || undefined);
  const autoDims = resolveBoxDims({ ...game, boxDims: undefined }, aspect);
  const autoLabel = presetFor(autoDims)?.label ?? "Measured size";
  const [custom, setCustom] = useState(() => value !== null && !presetFor(value));

  const mode = value === null ? "auto" : custom ? "custom" : presetFor(value)?.id ?? "custom";
  const shown = value ?? autoDims;
  const face = shelfBoxFor({ boxDims: shown } as Game);

  // Custom sizes are entered as the cover's width and height, plus depth
  const setCustomSide = (side: "width" | "height" | "depth", raw: string) => {
    const n = Number(raw);
    const next = { ...face, [side]: Number.isFinite(n) && n > 0 ? n : face[side] };
    onChange({
      width: next.width,
      length: next.height,
      depth: next.depth,
      orientation: next.width > next.height ? "landscape" : next.width < next.height ? "portrait" : undefined,
    });
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor="boxSize">Box Size</Label>
      <div className="flex items-center gap-3">
        <select
          id="boxSize"
          value={mode}
          onChange={(e) => {
            const id = e.target.value;
            if (id === "auto") {
              setCustom(false);
              onChange(null);
            } else if (id === "custom") {
              setCustom(true);
              onChange({ ...shown });
            } else {
              setCustom(false);
              onChange(BOX_PRESETS.find((p) => p.id === id)!.dims);
            }
          }}
          className={selectClass}
        >
          <option value="auto">Automatic · {autoLabel}</option>
          {BOX_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} ({p.example})
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {/* To-scale outline of the cover face */}
        <div className="flex size-10 shrink-0 items-center justify-center" aria-hidden>
          <div
            className="rounded-[2px] border-2 border-foreground/60 bg-muted"
            style={{
              width: `${(face.width / Math.max(face.width, face.height)) * 100}%`,
              height: `${(face.height / Math.max(face.width, face.height)) * 100}%`,
            }}
          />
        </div>
      </div>
      {mode === "custom" ? (
        <div className="grid grid-cols-3 gap-2">
          {(["width", "height", "depth"] as const).map((side) => (
            <label key={side} className="grid gap-1 text-xs text-muted-foreground">
              <span className="capitalize">{side} (in)</span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0.1"
                defaultValue={fmt(face[side])}
                onBlur={(e) => setCustomSide(side, e.target.value)}
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {describe(shown)}
          {mode === "auto" && (aspect ? " · picked from the cover's shape" : " · add a cover to pick a shape automatically")}
        </p>
      )}
    </div>
  );
}
