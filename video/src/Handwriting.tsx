// Self-writing handwritten accents (Gaegu Bold) for the notebook stages: the words appear left to right behind a mask
// whose edge moves like a pen, then a hand-drawn underline follows. On stages whose surface is too dark or too busy
// for the ink (Theme.handBacking, e.g. kraft-board) the words are written on a small torn paper label taped there. Only words that are already on screen or in the
// script (a tone label, the headline's key phrase, a dialogue's twist stamp), never new facts; never captions,
// headlines or mockup text.
import React from "react";
import {interpolate, useCurrentFrame} from "remotion";
import {HAND} from "./fonts";
import {drawn, handBox, handLine, seedOf} from "./hand";
import {clamp} from "./kit";
import {spr} from "./motion";
import {NOTE, TONES, useTheme} from "./themes";

// Speckled ink: fractal noise mapped to alpha, used as a mask so the stamp's ink has the odd dropout of a real stamp.
const INK_MASK = "data:image/svg+xml;utf8," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
  + "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='2' seed='7' stitchTiles='stitch'/>"
  + "<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.15'/></filter>"
  + "<rect width='300' height='300' filter='url(#n)'/></svg>");

/**
 * The twist stamp ("사기였습니다"): a rubber stamp slams onto the frozen frame at `at` (scene frames): it drops from
 * 1.7x with a short squash, lands on a slip of white note paper (so it reads on the dark phone panel and on paper
 * stages alike) and stays. Danger red ink, hand-drawn double frame, Gaegu lettering, speckled like real ink.
 */
export const Stamp: React.FC<{text: string; at: number; x: number; y: number; size?: number; rotate?: number}> = ({
  text, at, x, y, size = 112, rotate = -8,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const land = spr(frame, at, 7, 0.08); // 0 -> 1 with a small overshoot: the press
  const scale = 1 + 0.7 * (1 - land);
  const op = Math.min(1, (frame - at + 1) / 3);
  const w = [...text].reduce((a, ch) => a + (ch === " " ? 0.3 : 0.95), 0) * size + size * 0.9;
  const h = size * 1.75;
  const seed = seedOf(text);
  const outer = handBox(8, 8, w - 16, h - 16, 26, seed);
  const inner = handBox(22, 22, w - 44, h - 44, 18, seed + 3);
  const red = TONES.danger.fill;
  const ink = TONES.danger.ink;
  return (
    <div style={{position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, opacity: op,
      transform: `rotate(${rotate}deg) scale(${scale})`, pointerEvents: "none"}}>
      {/* the paper slip the stamp hits */}
      <div style={{position: "absolute", inset: -10, background: NOTE.paper, borderRadius: 18, opacity: 0.94,
        boxShadow: "0 18px 40px rgba(0,0,0,0.35)", transform: "rotate(2deg)"}} />
      <div style={{position: "absolute", inset: 0, WebkitMaskImage: `url("${INK_MASK}")`, maskImage: `url("${INK_MASK}")`,
        WebkitMaskSize: "300px 300px", maskSize: "300px 300px"}}>
        <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0, overflow: "visible"}}>
          <path {...drawn(outer, 1)} stroke={red} strokeWidth={9} />
          <path {...drawn(inner, 1)} stroke={red} strokeWidth={4} />
        </svg>
        <div style={{position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: HAND, fontWeight: 700, fontSize: size, lineHeight: 1, color: ink, whiteSpace: "nowrap",
          letterSpacing: -size * 0.01, paddingTop: size * 0.06}}>
          {text}
        </div>
      </div>
    </div>
  );
};

export const Handwrite: React.FC<{text: string; x: number; y: number; size: number; color: string; at: number;
  dur?: number; rotate?: number; underline?: string; align?: "left" | "center"}> = ({
  text, x, y, size, color, at, dur = 14, rotate = -4, underline, align = "left",
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = interpolate(frame, [at, at + dur], [0, 1], {...clamp, easing: (t) => t * (2 - t)});
  const label = interpolate(frame, [at - 6, at], [0, 1], clamp);
  const u = interpolate(frame, [at + dur - 2, at + dur + 8], [0, 1], clamp);
  if (p <= 0 && label <= 0) return null;
  const w = [...text].reduce((a, ch) => a + (ch === " " ? 0.3 : /[!?.,~]/.test(ch) ? 0.35 : 0.92), 0) * size;
  const line = handLine(4, 10, w - 4, 6, seedOf(text), 4);
  return (
    <div style={{position: "absolute", left: align === "center" ? x - w / 2 : x, top: y, width: w + 20,
      transform: `rotate(${rotate}deg)`, transformOrigin: "0 50%", pointerEvents: "none"}}>
      {theme.handBacking ? (
        // the label: torn-edged paper slip with a strip of tape, pressed on just before the pen starts
        <div style={{position: "absolute", left: -22, top: -size * 0.16, width: w + 44, height: size * 1.5,
          background: NOTE.paper, opacity: label, transform: `scale(${0.9 + 0.1 * label}) rotate(1.5deg)`,
          clipPath: "polygon(0 6%, 4% 0, 30% 4%, 58% 0, 86% 3%, 100% 0, 98% 52%, 100% 100%, 70% 96%, 40% 100%, 12% 97%, 0 100%, 2% 50%)",
          boxShadow: "0 6px 14px rgba(60,38,12,0.25)"}}>
          <div style={{position: "absolute", left: "38%", top: -size * 0.12, width: size * 1.2, height: size * 0.34,
            background: "rgba(246,238,216,0.85)", transform: "rotate(-4deg)"}} />
        </div>
      ) : null}
      {/* the pen: a soft-edged mask sweeping right */}
      <div style={{fontFamily: HAND, fontWeight: 700, fontSize: size, lineHeight: 1.05, color, whiteSpace: "nowrap",
        letterSpacing: -size * 0.01,
        WebkitMaskImage: `linear-gradient(90deg, #000 ${p * 100}%, transparent ${Math.min(100, p * 100 + 6)}%)`,
        maskImage: `linear-gradient(90deg, #000 ${p * 100}%, transparent ${Math.min(100, p * 100 + 6)}%)`}}>
        {text}
      </div>
      {underline ? (
        <svg width={w} height={22} style={{position: "absolute", left: 0, top: size * 1.02, overflow: "visible"}}>
          <path {...drawn(line, u)} stroke={underline} strokeWidth={size * 0.09} />
        </svg>
      ) : null}
    </div>
  );
};
