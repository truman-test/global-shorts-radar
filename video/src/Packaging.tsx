// Drama packaging (ShortProps.packaging "drama"): what a skit wears instead of the explainer's brand layer. No brand
// line, category or series chip, CTA or share line; one small honest disclosure chip ("재연 · AI 음성", top-left,
// through the last dramatized scene) and a fixed situation title at the top (1-2 lines, from frame 0 to the end, the
// way Korean skit channels pin theirs). 도치 does not lecture here: it is the silent 가시 감지기 that pops in from the
// lower-left corner with its spikes up and a "삐빅!" burst when a line says a known scam demand.
// Geometry: composition.json "packaging"; colours: tokens.json "drama". Everything is a pure function of the frame.
import React from "react";
import {interpolate, useCurrentFrame} from "remotion";
import {FONT} from "./fonts";
import {clamp} from "./kit";
import {Dochi, Pose} from "./Mascot";
import {spr} from "./motion";
import {isDrama, PACK, stagingOf} from "./rig";
import {DRAMA, isLight, MASCOT_PALETTES, useTheme} from "./themes";
import {Packaging, ShortProps} from "./types";

export const DISCLOSURE = "재연 · AI 음성";

/** The packaging of a Short: its own field, else drama when a scene is staged by characters. */
export const packagingOf = (props: ShortProps): Packaging => {
  if (props.packaging === "drama" || props.packaging === "explainer") return props.packaging;
  const cast = props.cast ?? {};
  return props.scenes.some((s) => isDrama(stagingOf(s, cast))) ? "drama" : "explainer";
};

/** The situation title's lines: a list, or a string broken at "\n"; at most maxLines. */
export const titleLines = (title?: string | string[]): string[] =>
  (Array.isArray(title) ? title : (title ?? "").split("\n")).map((s) => s.trim()).filter(Boolean)
    .slice(0, PACK.title.maxLines);

/** Font size that keeps the longest line inside the box (Hangul ~0.98 em; long plain-props titles shrink). */
const titleFont = (lines: string[]) => {
  const T = PACK.title;
  const room = 1080 - 2 * 36 - 2 * T.padX - 2 * T.border;
  const longest = Math.max(1, ...lines.map((l) => [...l].reduce((a, ch) => a + (ch === " " ? 0.32 : 0.98), 0)));
  return Math.min(T.font, Math.floor(room / longest));
};

/**
 * The fixed situation title: heavy dark ink on the note paper with an ink border, the last line on the yellow
 * caption band (the one accent). Static from frame 0 (the poster) to the last frame, so it is the first thing read.
 */
export const HookTitle: React.FC<{lines: string[]}> = ({lines}) => {
  if (!lines.length) return null;
  const T = PACK.title;
  const c = DRAMA.title;
  const font = titleFont(lines);
  return (
    <div style={{position: "absolute", top: T.top, left: 36, right: 36, display: "flex", justifyContent: "center",
      pointerEvents: "none"}}>
      <div style={{padding: `${T.padY}px ${T.padX}px`, background: c.bg, border: `${T.border}px solid ${c.border}`,
        borderRadius: 24, boxShadow: "0 14px 30px rgba(0,0,0,0.28)", display: "flex", flexDirection: "column",
        alignItems: "center", fontFamily: FONT}}>
        {lines.map((l, i) => (
          <div key={i} style={{fontSize: font, lineHeight: `${T.lineH}px`, fontWeight: 900, color: c.ink,
            whiteSpace: "nowrap", letterSpacing: -1.5, wordBreak: "keep-all"}}>
            {i === lines.length - 1 ? (
              <span style={{padding: "0 10px", borderRadius: 6, boxDecorationBreak: "clone",
                background: `linear-gradient(transparent 50%, ${c.band} 50%, ${c.band} 90%, transparent 90%)`}}>{l}</span>
            ) : l}
          </div>
        ))}
      </div>
    </div>
  );
};

/** The one disclosure chip: small and calm (white on a translucent dark pill), top-left, >= 26 px text. */
export const DisclosureChip: React.FC<{text: string}> = ({text}) => {
  const C = PACK.chip;
  return (
    <div style={{position: "absolute", left: C.x, top: C.y, height: C.h, padding: "0 18px", borderRadius: 12,
      background: DRAMA.disclosure.bg, color: DRAMA.disclosure.text, fontFamily: FONT, fontSize: C.font,
      fontWeight: 700, display: "flex", alignItems: "center", whiteSpace: "nowrap", letterSpacing: 0,
      pointerEvents: "none"}}>
      {text}
    </div>
  );
};

/** Frames of the spike pop: in (8), spikes up and the burst, out (8). */
export const SPIKE_FRAMES = PACK.spike.frames;
const IN = 8;
const BURST_AT = 6;

/**
 * 도치 the 가시 감지기 (a Sequence starting at the moment): pops in from the left edge onto the feet line just above
 * the speaker chip and the captions, its spikes shoot up with a shiver, alarm lines flash round its back and a
 * "삐빅!" burst pops over it; after ~1 s it ducks back out. No voice, no lecture.
 */
export const SpikeAlert: React.FC = () => {
  const f = useCurrentFrame();
  const theme = useTheme();
  const S = PACK.spike;
  if (f < 0 || f >= S.frames) return null;
  const night = !isLight(theme);
  const inP = spr(f, 0, IN, 0.08);
  const outP = interpolate(f, [S.frames - 8, S.frames], [0, 1], {...clamp, easing: (t) => t * t});
  const x = -S.size + (S.x + S.size) * inP - (S.x + S.size) * outP;
  const t = f - BURST_AT;
  const bristle = t < 0 ? 0.2 : Math.min(1, (t + 1) / 3);
  const pose: Pose = {x, y: S.feetY, size: S.size, lookX: 0.5, lookY: -0.5, expr: t >= 0 ? "alarmed" : "curious",
    paw: "none", pawAngle: 0, tilt: t >= 0 ? -5 : 4 * (1 - inP), bristle, shiver: t >= 0 && t < 12 ? 1 - t / 12 : 0,
    curl: 0, sweat: t >= 2, sy: t >= 0 && t < 4 ? 1.08 - 0.02 * t : 1, lift: t >= 0 && t < 5 ? 10 * Math.sin((t / 5) * Math.PI) : 0,
    walk: 0, opacity: 1};
  // alarm lines: short ink strokes shooting out round the spiky back as the spikes go up
  const grow = t < 0 ? 0 : spr(t, 0, 6, 0.1);
  const fadeLines = interpolate(t, [10, 18], [1, 0], clamp);
  const cx = x - 0.03 * S.size;
  const cy = S.feetY - 0.42 * S.size - pose.lift;
  const rays = [-160, -132, -104, -76, -48].map((deg) => {
    const a = (deg * Math.PI) / 180;
    const r0 = 0.72 * S.size;
    const r1 = r0 + 0.3 * S.size * grow;
    return `M ${cx + Math.cos(a) * r0} ${cy + Math.sin(a) * r0} L ${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}`;
  }).join(" ");
  const burst = t < 1 ? 0 : spr(t, 1, 7, 0.12);
  const b = DRAMA.spike;
  const bx = x + 0.5 * S.size;
  const by = S.feetY - 1.28 * S.size;
  return (
    <div style={{position: "absolute", inset: 0, pointerEvents: "none"}}>
      <Dochi pose={pose} blink={0} frame={f} palette={MASCOT_PALETTES[night ? "night" : "paper"]} rim={night ? 1 : 0} />
      {grow > 0 ? (
        // ink under a light core: the lines read on the dark call centre and on paper alike
        <svg width={1080} height={1920} style={{position: "absolute", inset: 0, opacity: fadeLines}}>
          <path d={rays} stroke={b.ring} strokeWidth={13} strokeLinecap="round" />
          <path d={rays} stroke={b.burst} strokeWidth={6} strokeLinecap="round" />
        </svg>
      ) : null}
      {burst > 0 ? (
        <div style={{position: "absolute", left: bx - 130, top: by - 80, width: 260, height: 160, display: "flex",
          alignItems: "center", justifyContent: "center", transform: `rotate(-6deg) scale(${burst})`,
          opacity: Math.min(1, burst * 1.5) * (1 - outP)}}>
          <svg width={260} height={160} viewBox="0 0 260 160" style={{position: "absolute", left: 0, top: 0}}>
            <path d={burstPath(130, 80, 124, 74, 14)} fill={b.burst} stroke={b.ring} strokeWidth={6} strokeLinejoin="round" />
          </svg>
          <div style={{position: "relative", fontFamily: FONT, fontSize: 54, fontWeight: 900, color: b.ink,
            whiteSpace: "nowrap", letterSpacing: -1, lineHeight: 1}}>삐빅!</div>
        </div>
      ) : null}
    </div>
  );
};

/** A comic burst: a star with `n` points round an ellipse (outer rx/ry, inner 78%). */
const burstPath = (cx: number, cy: number, rx: number, ry: number, n: number) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const k = i % 2 ? 0.78 : 1;
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")} Z`;
};
