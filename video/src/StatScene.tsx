import React from "react";
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {BODY_BOTTOM, BODY_TOP, clamp, MUTED, SceneHeader, SceneShell} from "./kit";
import {STAT_COUNT} from "./schedule";
import {ACCENTS, SceneProps} from "./types";

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
 * One big number: the numeric part counts up with an ease-out, lands with a small punch and a glow
 * ring sweep; the label and the sub-line follow.
 */
export const StatScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = ACCENTS[scene.accent];
  const full = scene.statValue ?? "";
  const [a, b] = STAT_COUNT;
  const t = interpolate(frame, [a, b], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const shown = countUp(full, t);
  const size = Math.min(220, Math.floor(860 / Math.max(1, emWidth(full))));
  const punch = spring({frame: frame - b, fps, config: {damping: 9, mass: 0.5}});
  const scale = frame < b ? 0.9 + 0.1 * t : 1 + 0.06 * Math.sin(Math.min(1, punch) * Math.PI);
  const labelIn = spring({frame: frame - (b - 6), fps, config: {damping: 15}});
  const subIn = interpolate(frame, [b + 4, b + 14], [0, 1], clamp);
  const meter = interpolate(frame, [a, b], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const numH = size * 1.12;
  const groupH = numH + 36 + 16 + 44 + 64 + (scene.sub ? 26 + 48 : 0);
  const top = BODY_TOP + Math.max(0, (BODY_BOTTOM - BODY_TOP - groupH) / 2) - 20;
  const meterTop = top + numH + 36;
  const METER_W = 640;

  return (
    <SceneShell>
      <SceneHeader scene={{...scene, sub: ""}} />
      <div style={{position: "absolute", left: 40, right: 40, top: top - 160, height: numH + 320,
        background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${accent}2e 0%, transparent 70%)`}} />
      <div style={{position: "absolute", top, left: 60, right: 60, textAlign: "center", fontSize: size,
        fontWeight: 900, letterSpacing: -size * 0.02, lineHeight: 1.12, color: accent,
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", transform: `scale(${scale})`,
        textShadow: `0 0 ${40 + punch * 30}px ${accent}88, 0 10px 40px rgba(0,0,0,0.6)`}}>
        {shown}
      </div>
      {/* meter that fills with the count */}
      <div style={{position: "absolute", top: meterTop, left: (1080 - METER_W) / 2, width: METER_W, height: 16,
        borderRadius: 8, background: "rgba(255,255,255,0.1)"}}>
        <div style={{width: METER_W * meter, height: "100%", borderRadius: 8, background: accent,
          boxShadow: `0 0 20px ${accent}`}} />
        <div style={{position: "absolute", top: -9, left: METER_W * meter - 17, width: 34, height: 34, borderRadius: "50%",
          background: "#fff", boxShadow: `0 0 24px ${accent}`, opacity: meter > 0.01 ? 1 : 0}} />
      </div>
      <div style={{position: "absolute", top: meterTop + 16 + 44, left: 140, right: 140, textAlign: "center",
        fontSize: 52, fontWeight: 800, lineHeight: 1.22, opacity: labelIn,
        transform: `translateY(${(1 - labelIn) * 20}px)`}}>
        {scene.statLabel}
      </div>
      {scene.sub ? (
        <div style={{position: "absolute", top: meterTop + 16 + 44 + 64 + 26, left: 140, right: 140, textAlign: "center",
          fontSize: 38, fontWeight: 700, color: MUTED, opacity: subIn, transform: `translateY(${(1 - subIn) * 10}px)`}}>
          {scene.sub}
        </div>
      ) : null}
    </SceneShell>
  );
};
