// Hand-drawn marks (our own, in the spirit of RoughNotation): circles, underlines, checks, crosses, arrows and
// rough boxes drawn in with strokeDashoffset. Every wobble comes from a seeded PRNG, so a mark looks the same on
// every frame and every render (never Math.random()).
import React from "react";

/** Deterministic PRNG (mulberry32). */
export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Stable 32-bit seed from a string. */
export const seedOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

type Pt = [number, number];

/** A polyline as an SVG path plus its exact length (so the dash animation draws it end to end). */
export type Stroke = {d: string; len: number};

const stroke = (pts: Pt[]): Stroke => {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return {d: "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L"), len: Math.max(1, len)};
};

/** Smooth 1-D noise from a few seeded sines (for slow radius/offset drift along a stroke). */
const noise = (seed: number) => {
  const r = rng(seed);
  const waves = [0, 1, 2].map((k) => ({f: 1 + k * 1.7 + r(), p: r() * Math.PI * 2, a: 1 / (k + 1)}));
  return (t: number) => waves.reduce((s, w) => s + w.a * Math.sin(t * w.f + w.p), 0) / 1.83;
};

/** A loose loop around an ellipse: starts a little off, goes round ~1.1 turns, radius drifting a few percent. */
export const handEllipse = (cx: number, cy: number, rx: number, ry: number, seed: number, turns = 1.12): Stroke => {
  const r = rng(seed);
  const n = noise(seed + 1);
  const a0 = -Math.PI * (0.62 + r() * 0.2);
  const N = 90;
  const pts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const a = a0 + u * Math.PI * 2 * turns;
    const k = 1 + 0.045 * n(u * 6) + 0.05 * u; // spirals out slightly so the overlap does not sit on itself
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return stroke(pts);
};

/** A slightly bowed, wobbly line (underline, arrow shaft, cross stroke). */
export const handLine = (x1: number, y1: number, x2: number, y2: number, seed: number, amp = 4): Stroke => {
  const n = noise(seed);
  const bow = (rng(seed + 7)() - 0.5) * amp * 2.2;
  const N = 24;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const [px, py] = [-dy / L, dx / L];
  const pts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const off = Math.sin(u * Math.PI) * bow + n(u * 5) * amp * 0.6;
    pts.push([x1 + dx * u + px * off, y1 + dy * u + py * off]);
  }
  return stroke(pts);
};

/** A rough rounded box drawn as one stroke from its top-left corner (flowchart nodes). */
export const handBox = (x: number, y: number, w: number, h: number, rad: number, seed: number): Stroke => {
  const n = noise(seed);
  const r = Math.min(rad, w / 2, h / 2);
  const pts: Pt[] = [];
  const corner = (cx: number, cy: number, from: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = from + (i / 6) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + r, y + r, Math.PI);
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  pts.push([x + 2, y + r - 2]); // closes with a small overshoot like a pen stroke
  pts.push([x + 6, y + r * 0.4]);
  const jittered = pts.map(([px, py], i): Pt => [px + n(i * 0.37) * 2.6, py + n(i * 0.29 + 9) * 2.6]);
  return stroke(jittered);
};

/** Check mark (short down-stroke, long up-stroke) inside a size x size box. */
export const handCheck = (size: number, seed: number): Stroke => {
  const a = handLine(size * 0.12, size * 0.52, size * 0.4, size * 0.8, seed, size * 0.02);
  const b = handLine(size * 0.4, size * 0.8, size * 0.9, size * 0.16, seed + 3, size * 0.03);
  const pts = (s: Stroke) => s.d.slice(1).split(" L").map((p) => p.split(" ").map(Number) as Pt);
  return stroke([...pts(a), ...pts(b).slice(1)]);
};

/** The two strokes of a cross inside a size x size box. */
export const handCross = (size: number, seed: number): [Stroke, Stroke] => [
  handLine(size * 0.14, size * 0.12, size * 0.86, size * 0.88, seed, size * 0.03),
  handLine(size * 0.84, size * 0.14, size * 0.16, size * 0.86, seed + 5, size * 0.03),
];

/** Dash props that reveal `s` up to progress p (0..1). */
export const drawn = (s: Stroke, p: number) => ({
  d: s.d, strokeDasharray: `${s.len} ${s.len + 2}`, strokeDashoffset: s.len * (1 - Math.min(1, Math.max(0, p))),
  fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  opacity: p > 0 ? 1 : 0,
});

/**
 * Hand-drawn loop around the parent box (absolutely positioned, overflows by `pad`). Put it inside a
 * position:relative element that wraps the thing to circle.
 */
export const HandCircle: React.FC<{p: number; color: string; seed: number; pad?: number; width?: number;
  w: number; h: number}> = ({p, color, seed, pad = 26, width = 7, w, h}) => {
  const W = w + pad * 2;
  const H = h + pad * 2;
  const s = handEllipse(W / 2, H / 2, W / 2 - width, H / 2 - width, seed);
  return (
    <svg width={W} height={H} style={{position: "absolute", left: -pad, top: -pad, overflow: "visible",
      pointerEvents: "none"}}>
      <path {...drawn(s, p)} stroke={color} strokeWidth={width} />
    </svg>
  );
};

/** Hand-drawn underline across the bottom of the parent box. */
export const HandUnderline: React.FC<{p: number; color: string; seed: number; w: number; y: number;
  width?: number}> = ({p, color, seed, w, y, width = 9}) => {
  const s = handLine(4, 10, w - 4, 6, seed, 5);
  return (
    <svg width={w} height={24} style={{position: "absolute", left: 0, top: y, overflow: "visible", pointerEvents: "none"}}>
      <path {...drawn(s, p)} stroke={color} strokeWidth={width} />
    </svg>
  );
};

/**
 * Highlighter band behind inline text: grows from the left with p (a clip of the band's width), sitting on the
 * lower ~60% of the line like a real marker stroke. The text stays on top and keeps its own colour.
 */
export const markerStyle = (color: string, p: number): React.CSSProperties => ({
  backgroundImage: `linear-gradient(${color}, ${color})`, backgroundRepeat: "no-repeat",
  backgroundPosition: "0 88%", backgroundSize: `${Math.min(1, Math.max(0, p)) * 100}% 58%`,
  padding: "0 6px", margin: "0 -6px", borderRadius: 6,
  boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
});
