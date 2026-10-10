import React from "react";
import {Easing, interpolate, useCurrentFrame} from "remotion";
import {BODY_BOTTOM, BODY_TOP, clamp, NoteCard, SceneHeader, SceneShell, useBody} from "./kit";
import {NOTE, useTone} from "./themes";
import {spr} from "./motion";
import {STAT_COUNT} from "./schedule";
import {SceneProps} from "./types";

const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;

const format = (v: number, decimals: number, grouped: boolean) => {
  const fixed = v.toFixed(decimals);
  if (!grouped) return fixed;
  const [int, dec] = fixed.split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec ? `.${dec}` : "");
};

/**
 * Every number in the value scaled by t (0..1), keeping its decimals and digit grouping:
 * countUp("1조 2,578억 원", 0.5) -> "1조 1,289억 원" (each group rounds on its own).
 */
const COMPOUND_RE = /\d\s*(조|억|만)\s*\d/; // "1조 2,578억": one amount written in several groups

export const countUp = (raw: string, t: number) => {
  let seen = 0;
  const all = COMPOUND_RE.test(raw); // otherwise ("10명 중 7명") only the first number counts
  return raw
    .replace(NUM_RE, (num) => {
      if (!all && seen++ > 0) return num;
      const decimals = num.includes(".") ? num.split(".")[1].length : 0;
      const value = parseFloat(num.replace(/,/g, ""));
      const scaled = decimals ? value * t : Math.round(value * t);
      return format(scaled, decimals, num.includes(","));
    })
    // "0조 978억 원" -> "978억 원" while a larger unit has not been reached yet
    .replace(/^(\D*?)0([^\d\s.,]+)\s+(?=\D*\d)/, all ? "$1" : "$&");
};

/** Rough rendered width in em: digits and punctuation are narrow, Hangul is ~1em. */
const emWidth = (s: string) => [...s].reduce((a, c) => a + (/[\d.,]/.test(c) ? 0.6 : c === " " ? 0.28 : 0.95), 0);

/**
 * One big number written on the note card: the numeric part counts up with an ease-out and lands with a small
 * punch while a meter fills under it; the label and the sub-line follow.
 */
export const StatScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const tone = useTone(scene.accent);
  const full = scene.statValue ?? "";
  const [a, b] = STAT_COUNT;
  const t = interpolate(frame, [a, b], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const shown = countUp(full, t);
  const size = Math.min(200, Math.floor((useBody().width - 100) / Math.max(1, emWidth(full))));
  const punch = spr(frame, b, 10, 0.03);
  const scale = frame < b ? 0.9 + 0.1 * t : 1 + 0.06 * Math.sin(Math.min(1, punch) * Math.PI);
  const labelIn = spr(frame, b - 6, 14);
  const subIn = interpolate(frame, [b + 4, b + 14], [0, 1], clamp);
  const meter = interpolate(frame, [a, b], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const body = useBody();
  const METER_W = Math.min(600, body.width - 160);
  const cardTop = BODY_TOP + 10;

  return (
    <SceneShell>
      <SceneHeader scene={{...scene, sub: ""}} />
      <NoteCard box={{top: cardTop, left: body.left, width: body.width, height: BODY_BOTTOM - 10 - cardTop}} fold={50}>
        <div style={{position: "absolute", inset: "30px 50px", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 0}}>
          <div style={{fontSize: size, fontWeight: 900, letterSpacing: -size * 0.02, lineHeight: 1.12, color: tone.ink,
            fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", transform: `scale(${scale})`}}>
            {shown}
          </div>
          {/* meter that fills with the count */}
          <div style={{position: "relative", marginTop: 30, width: METER_W, height: 16, borderRadius: 8,
            background: NOTE.rule}}>
            <div style={{width: METER_W * meter, height: "100%", borderRadius: 8, background: tone.fill}} />
            <div style={{position: "absolute", top: -9, left: METER_W * meter - 17, width: 34, height: 34,
              borderRadius: "50%", background: NOTE.paper, border: `6px solid ${tone.fill}`, boxSizing: "border-box",
              opacity: meter > 0.01 ? 1 : 0}} />
          </div>
          <div style={{marginTop: 44, textAlign: "center", fontSize: 50, fontWeight: 800, lineHeight: 1.22,
            color: NOTE.ink, opacity: Math.min(1, labelIn), transform: `translateY(${(1 - labelIn) * 20}px)`}}>
            {scene.statLabel}
          </div>
          {scene.sub ? (
            <div style={{marginTop: 22, textAlign: "center", fontSize: 36, fontWeight: 700, color: NOTE.muted,
              opacity: subIn, transform: `translateY(${(1 - subIn) * 10}px)`}}>
              {scene.sub}
            </div>
          ) : null}
        </div>
      </NoteCard>
    </SceneShell>
  );
};