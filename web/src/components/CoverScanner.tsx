import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Game } from "../models/Game";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackIcon, CloseIcon, ImageIcon, SearchIcon, SpinnerIcon } from "./icons";
import {
  loadImageFile,
  matchGames,
  normalize,
  readCover,
  toCanvas,
  warpQuad,
  type OcrResult,
  type Point,
  type Quad,
} from "@/lib/coverScan";

interface CoverScannerProps {
  games: Game[];
  onClose: () => void;
  /** The scan is a game that's already here */
  onPickGame: (game: Game, cover: string) => void;
  /** The scan is a new game; title is our best read of the box */
  onNewGame: (cover: string, title: string) => void;
}

type Stage = "camera" | "adjust" | "result";

const LOUPE = 104;

// Full-screen box scanner: camera → drag the corners onto the cover →
// flattened cover, matched to a game by reading its text on the device
export function CoverScanner({ games, onClose, onPickGame, onNewGame }: CoverScannerProps) {
  const [stage, setStage] = useState<Stage>("camera");
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrError, setOcrError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const start = (canvas: HTMLCanvasElement, corners: Quad) => {
    setSource(canvas);
    setQuad(corners);
    setStage("adjust");
  };

  const pickFile = async (file: File) => {
    try {
      const canvas = await loadImageFile(file);
      const w = canvas.width, h = canvas.height, m = Math.min(w, h) * 0.08;
      start(canvas, [[m, m], [w - m, m], [w - m, h - m], [m, h - m]]);
    } catch {
      alert("Couldn't read that image");
    }
  };

  // Flatten the cover, then read it; a newer scan cancels the older read
  const scanId = useRef(0);
  const finish = () => {
    if (!source || !quad) return;
    const warped = warpQuad(source, quad);
    setCover(warped.toDataURL("image/jpeg", 0.85));
    setOcr(null);
    setOcrError(false);
    setStage("result");
    const id = ++scanId.current;
    readCover(warped)
      .then((r) => id === scanId.current && setOcr(r))
      .catch((err) => {
        console.error("Cover OCR failed:", err);
        if (id === scanId.current) setOcrError(true);
      });
  };

  useEffect(() => () => void scanId.current++, []);

  return (
    <div
      data-vaul-no-drag
      className="fixed inset-0 z-[80] flex flex-col bg-black text-white animate-in fade-in duration-200"
      style={{ paddingTop: "var(--safe-top, env(safe-area-inset-top))", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <button
          type="button"
          onClick={stage === "camera" ? onClose : () => setStage(stage === "result" ? "adjust" : "camera")}
          aria-label={stage === "camera" ? "Close" : "Back"}
          className="flex size-11 items-center justify-center rounded-full bg-white/10 active:scale-95"
        >
          {stage === "camera" ? <CloseIcon className="size-5" /> : <BackIcon className="size-5" />}
        </button>
        <p className="text-sm font-medium text-white/80">
          {stage === "camera" ? "Scan box cover" : stage === "adjust" ? "Drag corners to the cover" : "Scanned cover"}
        </p>
        {stage === "camera" ? (
          <span className="size-11" />
        ) : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-full bg-white/10 active:scale-95"
          >
            <CloseIcon className="size-5" />
          </button>
        )}
      </div>

      {stage === "camera" && <CameraStage onCapture={start} onChooseFile={() => fileRef.current?.click()} />}
      {stage === "adjust" && source && quad && (
        <AdjustStage source={source} quad={quad} onChange={setQuad} onRetake={() => setStage("camera")} onDone={finish} />
      )}
      {stage === "result" && cover && (
        <ResultStage
          cover={cover}
          games={games}
          ocr={ocr}
          ocrError={ocrError}
          onPickGame={(g) => onPickGame(g, cover)}
          onNewGame={(title) => onNewGame(cover, title)}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) pickFile(file);
        }}
      />
    </div>
  );
}

function CameraStage({
  onCapture,
  onChooseFile,
}: {
  onCapture: (canvas: HTMLCanvasElement, quad: Quad) => void;
  onChooseFile: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(() =>
    "getUserMedia" in (navigator.mediaDevices ?? {}) ? null : "This browser can't open the camera."
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          video.play().catch(() => {});
        }
      })
      .catch(() => setError("Camera access was blocked. You can still pick a photo."));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const guide = guideRef.current;
    if (!video || !guide || !video.videoWidth) return;
    const canvas = toCanvas(video, video.videoWidth, video.videoHeight);
    // The video fills its box (object-cover); map the on-screen guide back into frame pixels
    const box = video.getBoundingClientRect();
    const g = guide.getBoundingClientRect();
    const s = Math.max(box.width / canvas.width, box.height / canvas.height);
    const ox = (box.width - canvas.width * s) / 2;
    const oy = (box.height - canvas.height * s) / 2;
    const at = (x: number, y: number): Point => [
      Math.min(canvas.width, Math.max(0, (x - box.left - ox) / s)),
      Math.min(canvas.height, Math.max(0, (y - box.top - oy) / s)),
    ];
    onCapture(canvas, [at(g.left, g.top), at(g.right, g.top), at(g.right, g.bottom), at(g.left, g.bottom)]);
  };

  return (
    <>
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          onLoadedData={() => setReady(true)}
          className="absolute inset-0 size-full object-cover"
        />
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-sm text-white/70">{error}</p>
            <Button variant="secondary" className="rounded-full" onClick={onChooseFile}>
              Choose photo
            </Button>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
            {/* Where to line up the box; it's also where the corners start */}
            <div
              ref={guideRef}
              className="aspect-square w-[min(80%,60dvh)] rounded-2xl shadow-[0_0_0_100vmax_rgb(0_0_0/0.35)] ring-2 ring-white/90"
            />
            <p className="text-sm font-medium text-white drop-shadow">Fit the box cover in the frame</p>
          </div>
        )}
      </div>
      <div className="grid h-28 shrink-0 grid-cols-3 items-center px-6">
        <button
          type="button"
          onClick={onChooseFile}
          aria-label="Choose photo"
          className="flex size-12 items-center justify-center rounded-full bg-white/10 active:scale-95"
        >
          <ImageIcon className="size-6" />
        </button>
        <button
          type="button"
          onClick={capture}
          disabled={!!error || !ready}
          aria-label="Take photo"
          className="mx-auto flex size-[72px] items-center justify-center rounded-full border-4 border-white/90 disabled:opacity-40"
        >
          <span className="size-14 rounded-full bg-white transition-transform active:scale-90" />
        </button>
        <span />
      </div>
    </>
  );
}

function AdjustStage({
  source,
  quad,
  onChange,
  onRetake,
  onDone,
}: {
  source: HTMLCanvasElement;
  quad: Quad;
  onChange: (quad: Quad) => void;
  onRetake: () => void;
  onDone: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const url = useMemo(() => source.toDataURL("image/jpeg", 0.9), [source]);
  const [drag, setDrag] = useState<{ index: number; dx: number; dy: number } | null>(null);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setArea({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the photo in the area, leaving room for the handles at its edges
  const pad = 20;
  const scale = area.w ? Math.min((area.w - pad * 2) / source.width, (area.h - pad * 2) / source.height) : 0;
  const dw = source.width * scale;
  const dh = source.height * scale;
  const screen = quad.map(([x, y]) => [x * scale, y * scale]) as Quad;

  const onPointerDown = (index: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.parentElement!.getBoundingClientRect();
    // Keep the finger's offset from the corner so the handle doesn't jump
    setDrag({ index, dx: screen[index][0] - (e.clientX - rect.left), dy: screen[index][1] - (e.clientY - rect.top) });
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || !scale) return;
    const rect = e.currentTarget.parentElement!.getBoundingClientRect();
    const x = Math.min(dw, Math.max(0, e.clientX - rect.left + drag.dx));
    const y = Math.min(dh, Math.max(0, e.clientY - rect.top + drag.dy));
    const next = [...quad] as Quad;
    next[drag.index] = [x / scale, y / scale];
    onChange(next);
  };

  const active = drag ? screen[drag.index] : null;
  const zoom = 2.5;

  return (
    <>
      <div ref={areaRef} className="relative flex flex-1 touch-none items-center justify-center overflow-hidden">
        {scale > 0 && (
          <div className="relative" style={{ width: dw, height: dh }}>
            <img src={url} alt="" className="size-full select-none" draggable={false} />
            <svg className="pointer-events-none absolute inset-0 overflow-visible" width={dw} height={dh}>
              <path
                fillRule="evenodd"
                fill="rgb(0 0 0 / 0.5)"
                d={`M0 0H${dw}V${dh}H0Z M${screen.map((p) => p.join(" ")).join(" L")}Z`}
              />
              <polygon
                points={screen.map((p) => p.join(",")).join(" ")}
                fill="none"
                stroke="white"
                strokeWidth={2}
                strokeLinejoin="round"
              />
            </svg>
            {screen.map(([x, y], i) => (
              <div
                key={i}
                role="slider"
                aria-label={["Top left", "Top right", "Bottom right", "Bottom left"][i] + " corner"}
                aria-valuenow={Math.round(x)}
                onPointerDown={onPointerDown(i)}
                onPointerMove={onPointerMove}
                onPointerUp={() => setDrag(null)}
                onPointerCancel={() => setDrag(null)}
                onLostPointerCapture={() => setDrag(null)}
                className="absolute flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ left: x, top: y }}
              >
                <span
                  className={`size-6 rounded-full border-[3px] border-white shadow-[0_2px_8px_rgb(0_0_0/0.5)] transition-transform ${
                    drag?.index === i ? "scale-125 bg-white/40" : "bg-white/20"
                  }`}
                />
              </div>
            ))}
            {active && (
              // Magnifier above the finger, so the corner stays visible while placing it
              <div
                className="pointer-events-none absolute overflow-hidden rounded-full border-2 border-white shadow-xl"
                style={{
                  width: LOUPE,
                  height: LOUPE,
                  left: Math.min(dw - LOUPE / 2, Math.max(LOUPE / 2, active[0])) - LOUPE / 2,
                  top: active[1] - LOUPE - 40 < -pad ? active[1] + 40 : active[1] - LOUPE - 40,
                  backgroundImage: `url(${url})`,
                  backgroundSize: `${dw * zoom}px ${dh * zoom}px`,
                  backgroundPosition: `${LOUPE / 2 - active[0] * zoom}px ${LOUPE / 2 - active[1] * zoom}px`,
                  backgroundColor: "black",
                  backgroundRepeat: "no-repeat",
                }}
              >
                <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex h-28 shrink-0 items-center gap-3 px-6">
        <Button variant="secondary" className="h-12 flex-1 rounded-full" onClick={onRetake}>
          Retake
        </Button>
        <Button className="h-12 flex-1 rounded-full bg-white text-black hover:bg-white/90" onClick={onDone}>
          Use scan
        </Button>
      </div>
    </>
  );
}

function ResultStage({
  cover,
  games,
  ocr,
  ocrError,
  onPickGame,
  onNewGame,
}: {
  cover: string;
  games: Game[];
  ocr: OcrResult | null;
  ocrError: boolean;
  onPickGame: (game: Game) => void;
  onNewGame: (title: string) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => (ocr ? matchGames(games, ocr) : []), [games, ocr]);
  const searched = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return games.filter((g) => normalize(g.title).includes(q)).slice(0, 8);
  }, [games, query]);
  const reading = !ocr && !ocrError;
  const list = query.trim() ? searched : matches;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <img
          src={cover}
          alt="Scanned cover"
          className="mx-auto mt-2 max-h-[34dvh] max-w-full rounded-lg shadow-[0_16px_48px_-12px_rgb(0_0_0/0.8)]"
        />

        <div className="mt-6">
          {reading ? (
            <p className="flex items-center gap-2 text-sm text-white/70">
              <SpinnerIcon className="size-4 animate-spin" /> Reading the cover…
            </p>
          ) : (
            <p className="text-sm text-white/70">
              {query.trim()
                ? searched.length
                  ? "Games"
                  : "No games match"
                : matches.length
                  ? matches.length === 1
                    ? "Looks like this one"
                    : "Is it one of these?"
                  : "Couldn't match it to a game"}
            </p>
          )}
          {list.length > 0 && (
            <ul className="mt-2 divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/10">
              {list.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => onPickGame(g)}
                    className="flex w-full items-center gap-3 p-3 text-left active:bg-white/10"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/10">
                      {g.coverArt && <img src={g.coverArt} alt="" className="size-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{g.title}</span>
                    <span className="text-sm text-white/60">Choose</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="relative mt-3">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find another game"
              className="h-11 rounded-full border-0 bg-white/10 pl-9 text-white placeholder:text-white/50"
            />
          </div>
        </div>
      </div>
      <div className="shrink-0 px-5 pb-4 pt-2">
        <Button
          className="h-12 w-full rounded-full bg-white text-black hover:bg-white/90"
          onClick={() => onNewGame(ocr?.title ?? "")}
        >
          Add as new game
        </Button>
      </div>
    </div>
  );
}
