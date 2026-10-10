// Self-writing handwritten accents (Gaegu Bold) for the paper stage: the words appear left to right behind a mask
// whose edge moves like a pen, then a hand-drawn underline follows. Only words that are already on screen or in the
// script (a tone label, the headline's key phrase), never new facts; never captions, headlines or mockup text.
import React from "react";
import {interpolate, useCurrentFrame} from "remotion";
import {HAND} from "./fonts";
import {drawn, handLine, seedOf} from "./hand";
import {clamp} from "./kit";

export const Handwrite: React.FC<{text: string; x: number; y: number; size: number; color: string; at: number;
  dur?: number; rotate?: number; underline?: string; align?: "left" | "center"}> = ({
  text, x, y, size, color, at, dur = 14, rotate = -4, underline, align = "left",
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + dur], [0, 1], {...clamp, easing: (t) => t * (2 - t)});
  const u = interpolate(frame, [at + dur - 2, at + dur + 8], [0, 1], clamp);
  if (p <= 0) return null;
  const w = [...text].reduce((a, ch) => a + (ch === " " ? 0.3 : /[!?.,~]/.test(ch) ? 0.35 : 0.92), 0) * size;
  const line = handLine(4, 10, w - 4, 6, seedOf(text), 4);
  return (
    <div style={{position: "absolute", left: align === "center" ? x - w / 2 : x, top: y, width: w + 20,
      transform: `rotate(${rotate}deg)`, transformOrigin: "0 50%", pointerEvents: "none"}}>
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
