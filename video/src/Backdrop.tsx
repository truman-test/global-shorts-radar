// Procedural backgrounds, one per theme pattern (themes.ts). No stock assets: SVG/CSS only, every frame a pure
// function of the frame number (and the episode seed). Motion stays slow and low-contrast so it never competes with
// the captions. The four widened notebook stages live in NotebookStages.tsx.
import React, {useMemo} from "react";
import {AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig} from "remotion";
import {fade} from "./motion";
import {DeskSpread, KraftBoard, MoodSky, NightLamp} from "./NotebookStages";
import {CAPTION_CALM, H, PaperGrain, rng, W} from "./textures";
import {assertNever, CategoryName, isLight, Pattern, skyFor, SkyState, Theme, toneOf, useCategory, useSeed,
  useTheme} from "./themes";
import {Accent, ShortProps} from "./types";

const sceneSpans = (props: ShortProps, fps: number) => {
  let from = 0;
  return props.scenes.map((s) => {
    const frames = Math.max(1, Math.round((s.durationMs / 1000) * fps));
    const out = {from, frames};
    from += frames;
    return out;
  });
};

const ink = (t: Theme, a: number) => `rgba(${t.ink},${a})`;
const hex2 = (a: number) => Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, "0");

/* ---------------------------------------------------------------- classic: drifting square grid */
const Grid: React.FC<{frame: number}> = ({frame}) => (
  <AbsoluteFill style={{opacity: 0.08,
    backgroundImage: "linear-gradient(rgba(255,255,255,0.9) 2px, transparent 2px), "
      + "linear-gradient(90deg, rgba(255,255,255,0.9) 2px, transparent 2px)",
    backgroundSize: "90px 90px", backgroundPosition: `0px ${(frame * 0.7) % 90}px`}} />
);

/* ---------------------------------------------------------------- pulse: concentric rings + sweep */
const RING_C = {x: 540, y: 820};
const Rings: React.FC<{frame: number; theme: Theme; color: string}> = ({frame, theme, color}) => {
  const SP = 124;
  const phase = (frame / 165) % 1; // one ring spacing every 5.5 s
  const rings = Array.from({length: 15}, (_, k) => {
    const r = (k + phase) * SP;
    const a = 0.15 * Math.max(0, 1 - r / 1500) * Math.min(1, r / 160);
    return <circle key={k} cx={RING_C.x} cy={RING_C.y} r={r} fill="none" stroke={ink(theme, a)} strokeWidth={2} />;
  });
  const ticks = Array.from({length: 72}, (_, k) => {
    const ang = (k / 72) * Math.PI * 2;
    const r0 = 500;
    const r1 = r0 + (k % 6 === 0 ? 26 : 12);
    return <line key={k} x1={RING_C.x + Math.cos(ang) * r0} y1={RING_C.y + Math.sin(ang) * r0}
      x2={RING_C.x + Math.cos(ang) * r1} y2={RING_C.y + Math.sin(ang) * r1} stroke={ink(theme, 0.08)} strokeWidth={2} />;
  });
  const sweep = (frame * 0.4) % 360; // one turn every 30 s
  return (
    <>
      <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
        {rings}
        {ticks}
      </svg>
      <AbsoluteFill style={{
        background: `conic-gradient(from ${sweep}deg at ${RING_C.x}px ${RING_C.y}px, transparent 0deg, ${color}${hex2(0.16)} 58deg, transparent 58.5deg)`,
        maskImage: `radial-gradient(circle at ${RING_C.x}px ${RING_C.y}px, #000 0px, #000 380px, transparent 900px)`,
        WebkitMaskImage: `radial-gradient(circle at ${RING_C.x}px ${RING_C.y}px, #000 0px, #000 380px, transparent 900px)`}} />
    </>
  );
};

/* ---------------------------------------------------------------- circuit: traces with travelling signals */
type Trace = {d: string; len: number; ends: [number, number][]};
const makeTraces = (): Trace[] => {
  const r = rng(20261010);
  const G = 60;
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const out: Trace[] = [];
  for (let i = 0; i < 38; i++) {
    let x = Math.floor(r() * 19) * G;
    let y = Math.floor(r() * 33) * G;
    let d = Math.floor(r() * 4) * 2; // start orthogonal
    const pts: [number, number][] = [[x, y]];
    let len = 0;
    const segs = 2 + Math.floor(r() * 4);
    for (let s = 0; s < segs; s++) {
      const n = 1 + Math.floor(r() * 4);
      const [dx, dy] = dirs[d];
      const nx = Math.min(W, Math.max(0, x + dx * n * G));
      const ny = Math.min(H, Math.max(0, y + dy * n * G));
      len += Math.hypot(nx - x, ny - y);
      x = nx;
      y = ny;
      pts.push([x, y]);
      d = (d + (r() < 0.5 ? 1 : 7)) % 8; // bend 45 degrees
    }
    out.push({d: "M" + pts.map(([px, py]) => `${px} ${py}`).join(" L"), len, ends: [pts[0], pts[pts.length - 1]]});
  }
  return out;
};
const Traces: React.FC<{frame: number; theme: Theme; color: string}> = ({frame, theme, color}) => {
  const traces = useMemo(makeTraces, []);
  return (
    <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
      {traces.map((t, i) => (
        <g key={i}>
          <path d={t.d} fill="none" stroke={ink(theme, 0.075)} strokeWidth={3} strokeLinejoin="round" />
          {t.ends.map(([x, y], k) => (
            <circle key={k} cx={x} cy={y} r={7} fill="#0e1114" stroke={ink(theme, 0.12)} strokeWidth={3} />
          ))}
        </g>
      ))}
      {traces.filter((_, i) => i % 3 === 0).map((t, i) => {
        const D = 70;
        const cycle = t.len + D + 700;
        const s = ((frame * 3 + i * 211) % cycle) - D;
        return (
          <path key={`s${i}`} d={t.d} fill="none" stroke={color} strokeOpacity={0.5} strokeWidth={3}
            strokeLinecap="round" strokeDasharray={`${D} ${cycle * 2}`} strokeDashoffset={-s} />
        );
      })}
    </svg>
  );
};

/* ---------------------------------------------------------------- scan: diagonal hatching + scan band */
const Diagonal: React.FC<{frame: number; theme: Theme; color: string}> = ({frame, theme, color}) => {
  const P = 26;
  const band = ((frame * 2.4) % (H + 900)) - 450;
  return (
    <>
      <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
        <defs>
          <pattern id="hatch" width={P} height={P} patternUnits="userSpaceOnUse"
            patternTransform={`rotate(-32) translate(${(frame * 0.35) % P} 0)`}>
            <rect x={0} y={0} width={2} height={P} fill={ink(theme, 0.06)} />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#hatch)" />
      </svg>
      <div style={{position: "absolute", left: 0, right: 0, top: band - 210, height: 420,
        background: `linear-gradient(180deg, transparent, ${color}${hex2(0.07)} 50%, transparent)`}} />
      <div style={{position: "absolute", left: 0, right: 0, top: band, height: 2, background: ink(theme, 0.08)}} />
    </>
  );
};

/* ---------------------------------------------------------------- aurora: blurred ribbons + silk lines */
const Ribbons: React.FC<{frame: number; theme: Theme}> = ({frame, theme}) => {
  const t = frame / 30;
  const blobs = [
    {c: "#7b4dff", w: 1500, h: 420, x: -220, y: 260, rot: -18, a: 0.26, sx: 70, sy: 40, p: 19},
    {c: "#d64bc9", w: 1300, h: 360, x: -60, y: 1420, rot: 14, a: 0.18, sx: 90, sy: 50, p: 23},
    {c: "#2bc7c0", w: 1100, h: 300, x: 260, y: 820, rot: -10, a: 0.10, sx: 60, sy: 60, p: 29},
  ];
  const silk = (cy: number, k: number, amp: number) => {
    const pts: string[] = [];
    for (let x = -40; x <= W + 40; x += 40) {
      const y = cy + k * 14 + Math.sin(x / 260 + t * 0.22 + k * 0.18) * amp + Math.sin(x / 120 - t * 0.15) * 10;
      pts.push(`${x} ${y.toFixed(1)}`);
    }
    return "M" + pts.join(" L");
  };
  return (
    <>
      {blobs.map((b, i) => (
        <div key={i} style={{position: "absolute", left: b.x + Math.sin((t * 2 * Math.PI) / b.p) * b.sx,
          top: b.y + Math.cos((t * 2 * Math.PI) / (b.p * 1.3)) * b.sy, width: b.w, height: b.h, borderRadius: "50%",
          background: b.c, opacity: b.a, filter: "blur(120px)", transform: `rotate(${b.rot}deg)`}} />
      ))}
      <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
        {Array.from({length: 11}, (_, k) => (
          <path key={`a${k}`} d={silk(150, k, 60)} fill="none" stroke={ink(theme, 0.05)} strokeWidth={1.6} />
        ))}
        {Array.from({length: 11}, (_, k) => (
          <path key={`b${k}`} d={silk(1590, k, 70)} fill="none" stroke={ink(theme, 0.05)} strokeWidth={1.6} />
        ))}
      </svg>
    </>
  );
};

/* ---------------------------------------------------------------- contour: topographic lines (marching squares) */
const STEP = 20;
const topoPaths = (t: number): {d: string; index: boolean}[] => {
  const bumps = [
    {x: 230 + Math.sin(t * 0.05) * 60, y: 560 + Math.cos(t * 0.04) * 50, s: 300, a: 1.0},
    {x: 880 + Math.cos(t * 0.045) * 50, y: 1380 + Math.sin(t * 0.05) * 60, s: 360, a: 0.9},
    {x: 820 + Math.sin(t * 0.035) * 40, y: 220, s: 220, a: 0.55},
    {x: 160, y: 1650 + Math.cos(t * 0.04) * 40, s: 240, a: -0.45},
    {x: 560 + Math.sin(t * 0.03) * 50, y: 980, s: 260, a: -0.35},
  ];
  const f = (x: number, y: number) => {
    let v = 0.18 * Math.sin(x / 230 + t * 0.06) * Math.cos(y / 290 - t * 0.05);
    for (const b of bumps) v += b.a * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.s * b.s));
    return v;
  };
  const nx = Math.ceil(W / STEP) + 1;
  const ny = Math.ceil(H / STEP) + 1;
  const g = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g[j * nx + i] = f(i * STEP, j * STEP);
  const out: {d: string; index: boolean}[] = [];
  for (let L = -0.5, n = 0; L <= 1.0; L += 0.075, n++) {
    const segs: string[] = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = g[j * nx + i], b = g[j * nx + i + 1], c = g[(j + 1) * nx + i + 1], d = g[(j + 1) * nx + i];
        const code = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const x0 = i * STEP, y0 = j * STEP;
        const top = () => [x0 + STEP * ((L - a) / (b - a)), y0];
        const right = () => [x0 + STEP, y0 + STEP * ((L - b) / (c - b))];
        const bottom = () => [x0 + STEP * ((L - d) / (c - d)), y0 + STEP];
        const left = () => [x0, y0 + STEP * ((L - a) / (d - a))];
        const seg = (p: number[], q: number[]) =>
          segs.push(`M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`);
        switch (code) {
          case 1: case 14: seg(left(), bottom()); break;
          case 2: case 13: seg(bottom(), right()); break;
          case 3: case 12: seg(left(), right()); break;
          case 4: case 11: seg(top(), right()); break;
          case 6: case 9: seg(top(), bottom()); break;
          case 7: case 8: seg(left(), top()); break;
          case 5: seg(left(), top()); seg(bottom(), right()); break;
          case 10: seg(top(), right()); seg(left(), bottom()); break;
        }
      }
    }
    out.push({d: segs.join(""), index: n % 4 === 0});
  }
  return out;
};
const Topo: React.FC<{frame: number; theme: Theme}> = ({frame, theme}) => {
  const paths = topoPaths(frame / 30);
  return (
    <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke={ink(theme, p.index ? 0.11 : 0.055)} strokeWidth={p.index ? 2.6 : 1.8}
          strokeLinecap="round" />
      ))}
    </svg>
  );
};

/* ---------------------------------------------------------------- notebook (dark, re-renders only): ruled lines + grain */
const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>"
  + "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='7' stitchTiles='stitch'/>"
  + "<feColorMatrix values='0 0 0 0 1  0 0 0 0 0.93  0 0 0 0 0.84  0.6 0 0 0 -0.22'/></filter>"
  + "<rect width='240' height='240' filter='url(#n)'/></svg>");
const Ruled: React.FC<{frame: number; theme: Theme}> = ({frame, theme}) => {
  const P = 72;
  return (
    <>
      <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
        <defs>
          <pattern id="ruled" width={W} height={P} patternUnits="userSpaceOnUse"
            patternTransform={`translate(0 ${-((frame * 0.25) % P)})`}>
            <rect x={0} y={P - 2} width={W} height={2} fill={ink(theme, 0.065)} />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#ruled)" />
        <rect x={112} y={0} width={2} height={H} fill={`${theme.accents.red}${hex2(0.16)}`} />
        <rect x={120} y={0} width={2} height={H} fill={`${theme.accents.red}${hex2(0.09)}`} />
      </svg>
      <AbsoluteFill style={{backgroundImage: `url("${GRAIN}")`, backgroundSize: "240px 240px", opacity: 0.55}} />
    </>
  );
};

/* ---------------------------------------------------------------- paper stages (종이 노트): cream page + grain */

/** Punched holes down the left edge: the page is torn from the channel's notebook. */
const Holes: React.FC = () => (
  <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
    <defs>
      <radialGradient id="hole" cx="45%" cy="40%" r="60%">
        <stop offset="0" stopColor="#c9bfa9" />
        <stop offset="0.7" stopColor="#ddd3bf" />
        <stop offset="1" stopColor="#efe8da" />
      </radialGradient>
    </defs>
    {[300, 760, 1220, 1680].map((y) => (
      <g key={y}>
        <circle cx={44} cy={y + 2} r={19} fill="rgba(80,60,30,0.10)" />
        <circle cx={44} cy={y} r={18} fill="url(#hole)" stroke="rgba(120,100,70,0.35)" strokeWidth={1.5} />
      </g>
    ))}
  </svg>
);

/** 줄노트: blue rules every 68 px under a blank head band, a red double margin line. */
const PaperRuled: React.FC<{theme: Theme}> = ({theme}) => {
  const P = 68;
  const a = theme.patternInk;
  return (
    <>
      <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
        {Array.from({length: Math.floor((H - 150) / P)}, (_, k) => (
          <rect key={k} x={0} y={150 + (k + 1) * P} width={W} height={2} fill={`rgba(64,110,180,${a})`} />
        ))}
        <rect x={112} y={0} width={2.5} height={H} fill="rgba(214,72,72,0.36)" />
        <rect x={120} y={0} width={2} height={H} fill="rgba(214,72,72,0.22)" />
      </svg>
      <Holes />
    </>
  );
};

/** 모눈: a fine square grid, every fifth line a little stronger. */
const PaperGraph: React.FC<{theme: Theme}> = ({theme}) => {
  const P = 54;
  const a = theme.patternInk;
  const lines: React.ReactNode[] = [];
  for (let k = 0; k * P <= W; k++) {
    lines.push(<rect key={`v${k}`} x={k * P} y={0} width={k % 5 === 0 ? 2.4 : 1.4} height={H}
      fill={`rgba(52,96,120,${k % 5 === 0 ? a : a * 0.6})`} />);
  }
  for (let k = 0; k * P <= H; k++) {
    lines.push(<rect key={`h${k}`} x={0} y={k * P} width={W} height={k % 5 === 0 ? 2.4 : 1.4}
      fill={`rgba(52,96,120,${k % 5 === 0 ? a : a * 0.6})`} />);
  }
  return <svg width={W} height={H} style={{position: "absolute", inset: 0}}>{lines}</svg>;
};

/* ---------------------------------------------------------------- dots: dot matrix with a passing light wave */
const Matrix: React.FC<{frame: number; theme: Theme; color: string}> = ({frame, theme, color}) => {
  const P = 30;
  const travel = 3600;
  const wave = ((frame * 2.6) % travel) - 1200; // position of the wave along the diagonal
  const grad = (id: string, off: number) => (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={wave + off - 500} y1={0} x2={wave + off + 500} y2={1100}>
      <stop offset="0" stopColor="#fff" stopOpacity={0} />
      <stop offset="0.5" stopColor="#fff" stopOpacity={1} />
      <stop offset="1" stopColor="#fff" stopOpacity={0} />
    </linearGradient>
  );
  return (
    <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
      <defs>
        <pattern id="dot" width={P} height={P} patternUnits="userSpaceOnUse">
          <circle cx={P / 2} cy={P / 2} r={2.2} fill={ink(theme, 0.1)} />
        </pattern>
        <pattern id="dotHi" width={P} height={P} patternUnits="userSpaceOnUse">
          <circle cx={P / 2} cy={P / 2} r={2.6} fill={color} fillOpacity={0.4} />
        </pattern>
        {grad("wa", 0)}
        {grad("wb", -travel / 2)}
        <mask id="wave">
          <rect width={W} height={H} fill="url(#wa)" />
          <rect width={W} height={H} fill="url(#wb)" />
        </mask>
      </defs>
      <rect width={W} height={H} fill="url(#dot)" />
      <rect width={W} height={H} fill="url(#dotHi)" mask="url(#wave)" />
    </svg>
  );
};

/** Where the two accent glows sit, per pattern (fractions of the frame). */
const GLOWS: Record<Pattern, [number, number, number, number]> = {
  grid: [-250, 120, -300, 80],
  rings: [-160, 420, -260, 200],
  traces: [-320, 40, -220, 260],
  diagonal: [-200, 260, -340, 60],
  ribbons: [-300, 700, -300, 260],
  topo: [-260, 160, -260, 120],
  ruledDark: [-220, 300, -300, 160],
  matrix: [-280, 200, -260, 120],
  ruled: [0, 0, 0, 0],
  graph: [0, 0, 0, 0],
  lamp: [0, 0, 0, 0],
  kraft: [0, 0, 0, 0],
  spread: [0, 0, 0, 0],
  sky: [0, 0, 0, 0],
};

/** The mood-sky weather at this frame: the previous scene's sky crossfading into this scene's. */
export type SkyMix = {from: SkyState; to: SkyState; mix: number};

type LayerArgs = {frame: number; theme: Theme; color: string; seed: number; category: CategoryName; sky: SkyMix};

/** Every Pattern has a renderer (exhaustive: a new pattern without one fails to type-check). */
const PatternLayer: React.FC<{pattern: Pattern} & LayerArgs> = ({pattern, frame, theme, color, seed, category, sky}) => {
  switch (pattern) {
    case "grid": return <Grid frame={frame} />;
    case "rings": return <Rings frame={frame} theme={theme} color={color} />;
    case "traces": return <Traces frame={frame} theme={theme} color={color} />;
    case "diagonal": return <Diagonal frame={frame} theme={theme} color={color} />;
    case "ribbons": return <Ribbons frame={frame} theme={theme} />;
    case "topo": return <Topo frame={frame} theme={theme} />;
    case "ruledDark": return <Ruled frame={frame} theme={theme} />;
    case "matrix": return <Matrix frame={frame} theme={theme} color={color} />;
    case "ruled": return <PaperRuled theme={theme} />;
    case "graph": return <PaperGraph theme={theme} />;
    case "lamp": return <NightLamp seed={seed} />;
    case "kraft": return <KraftBoard seed={seed} category={category} />;
    case "spread": return <DeskSpread frame={frame} seed={seed} category={category} />;
    case "sky": return <MoodSky frame={frame} seed={seed} theme={theme} from={sky.from} to={sky.to} mix={sky.mix} />;
    default: return assertNever(pattern);
  }
};

/** Stages that draw their own surface, texture and light (and calm the caption band themselves). */
const FULL_STAGE: ReadonlySet<Pattern> = new Set<Pattern>(["lamp", "kraft", "spread", "sky"]);

/**
 * Stage background: base colours and the theme's pattern; on dark (경보) stages two soft glows follow the scene
 * tone (the category colour for "blue" scenes) under a dark vignette, on the classic paper pages the page grain and
 * a warm vignette. The full notebook stages (night-lamp, kraft-board, desk-spread, mood-sky) draw everything
 * themselves; mood-sky's weather follows the scene tone (and returns to the opening scene's in the poster tail).
 */
export const Backdrop: React.FC<{props: ShortProps}> = ({props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const theme = useTheme();
  const category = useCategory();
  const seed = useSeed();
  const spans = sceneSpans(props, fps);
  const n = props.scenes.length;
  const end = n ? spans[n - 1].from + spans[n - 1].frames : 0;
  let idx = spans.findIndex((s) => frame < s.from + s.frames);
  if (idx < 0) idx = n - 1;
  const glowOf = (a: Accent) => (a === "blue" ? toneOf(a, category).fill : theme.accents[a]);
  const prev = props.scenes[Math.max(0, idx - 1)]?.accent ?? "blue";
  const cur = props.scenes[idx]?.accent ?? "blue";
  const color = idx >= 0 && spans[idx]
    ? interpolateColors(fade(frame, spans[idx].from, 16), [0, 1], [glowOf(prev), glowOf(cur)]) : glowOf("blue");
  const skyOf = (i: number): SkyState => (props.scenes[i] ? skyFor(props.scenes[i].accent, i === n - 1) : "day");
  const sky: SkyMix = n && frame >= end
    ? {from: skyOf(n - 1), to: skyOf(0), mix: fade(frame, end, 6)} // poster tail: back to the opening sky
    : {from: skyOf(Math.max(0, idx - 1)), to: skyOf(idx),
      mix: idx > 0 && spans[idx] ? fade(frame, spans[idx].from, 14) : 1};
  const gx = Math.sin(frame / 55) * 80;
  const gy = Math.cos(frame / 70) * 60;
  const [l1, t1, r2, b2] = GLOWS[theme.pattern];
  const light = isLight(theme);
  const layer = <PatternLayer pattern={theme.pattern} frame={frame} theme={theme} color={color} seed={seed}
    category={category} sky={sky} />;
  if (FULL_STAGE.has(theme.pattern)) return <AbsoluteFill style={{background: theme.base}}>{layer}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{background: theme.base}}>
      {light ? <PaperGrain /> : null}
      <AbsoluteFill style={{maskImage: CAPTION_CALM, WebkitMaskImage: CAPTION_CALM}}>{layer}</AbsoluteFill>
      {theme.glow > 0 ? (
        <>
          <div style={{position: "absolute", width: 900, height: 900, left: l1 + gx, top: t1 + gy, borderRadius: "50%",
            background: color, opacity: theme.glow, filter: "blur(160px)"}} />
          <div style={{position: "absolute", width: 800, height: 800, right: r2 - gx, bottom: b2 - gy, borderRadius: "50%",
            background: color, opacity: theme.glow * 0.64, filter: "blur(170px)"}} />
        </>
      ) : null}
      <AbsoluteFill style={{background: light
        ? "radial-gradient(ellipse at center, transparent 55%, rgba(110,84,40,0.16) 100%)"
        : "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)"}} />
    </AbsoluteFill>
  );
};
