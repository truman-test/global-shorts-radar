import React, {useMemo} from "react";
import {interpolate, interpolateColors, useCurrentFrame, useVideoConfig} from "remotion";
import {rng, seedOf} from "./hand";
import {BODY_BOTTOM, BODY_TOP, clamp, NoteCard, SceneHeader, SceneShell} from "./kit";
import {spr} from "./motion";
import {dotBeats} from "./schedule";
import {CATEGORIES, NOTE, TONES, useCategory, useTone} from "./themes";
import {SceneProps} from "./types";

const MAX_DOTS = 400;
const NICE = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

/** People per dot: 1 when the total fits, else the smallest round unit that keeps the grid at <= 400 dots. */
export const dotUnit = (total: number) =>
  NICE.find((u) => total % u === 0 && total / u <= MAX_DOTS) ?? Math.ceil(total / MAX_DOTS);

const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

/**
 * Seeded dot simulation on the note card: a grid stands for `total` people; at each stage (narrated in turn) a
 * seeded random subset of the previous stage's dots changes colour, each dot at its own seeded moment, while the
 * counter rolls to the stage's number. Every number on screen comes from the script.
 */
export const DotsScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tone = useTone(scene.accent);
  const cat = CATEGORIES[useCategory()];
  const total = Math.max(1, Math.round(scene.total ?? 100));
  const stages = scene.stages ?? [];
  const unit = scene.unit ?? "명";
  const per = dotUnit(total);
  const D = Math.max(1, Math.round(total / per));
  const cols = D <= 100 ? 10 : 20;
  const rows = Math.ceil(D / cols);
  const beats = dotBeats(scene, fps);
  const seed = seedOf(`${scene.headline}|${total}`);
  // one seeded permutation: stage k colours its first n_k dots, so every stage is a subset of the one before
  const {order, delay} = useMemo(() => {
    const r = rng(seed);
    const idx = Array.from({length: D}, (_, i) => i);
    for (let i = D - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const rank = new Array<number>(D);
    idx.forEach((dot, k) => (rank[dot] = k));
    return {order: rank, delay: Array.from({length: D}, () => Math.floor(r() * 16))};
  }, [seed, D]);
  const counts = stages.map((s) => Math.max(s.count > 0 ? 1 : 0, Math.round(s.count / per)));
  const start = stages.length > 1 ? (scene.accent === "blue" ? TONES.caution.fill : cat.fill) : tone.fill;
  // a ramp from the category colour (or amber) through amber to the scene tone: each stage clearly its own colour
  const ramp = [start, start === TONES.caution.fill ? cat.fill : TONES.caution.fill, tone.fill];
  const colors = stages.map((_, k) => (stages.length > 2
    ? interpolateColors(k / (stages.length - 1), [0, 0.5, 1], ramp)
    : stages.length === 2 ? [start, tone.fill][k] : tone.fill));
  const current = beats.reduce((c, at, k) => (frame >= at ? k : c), -1);

  // counter: total before the first stage, then rolls from the previous number to this stage's
  const roll = current >= 0 ? interpolate(frame, [beats[current], beats[current] + 14], [0, 1], clamp) : 1;
  const from = current <= 0 ? total : stages[current - 1].count;
  const to = current >= 0 ? stages[current].count : total;
  const value = from + (to - from) * (1 - (1 - roll) ** 3);
  const label = current >= 0 ? stages[current].label : "전체";
  const labelColor = current >= 0 ? (current === stages.length - 1 ? tone.ink : NOTE.ink) : NOTE.muted;
  const gridIn = spr(frame, 2, 14, 0);

  const cardTop = BODY_TOP + 6;
  const cardH = BODY_BOTTOM - 6 - cardTop;
  const GRID_W = 700;
  const GRID_H = 300;
  const pitch = Math.min(GRID_W / cols, GRID_H / rows);
  const r0 = pitch * 0.36;
  const gx = (860 - pitch * cols) / 2;

  return (
    <SceneShell>
      <SceneHeader scene={scene} />
      <NoteCard box={{top: cardTop, left: 110, width: 860, height: cardH}} fold={50}>
        {/* counter */}
        <div style={{position: "absolute", top: 34, left: 0, right: 0, display: "flex", alignItems: "baseline",
          justifyContent: "center", gap: 22}}>
          <div style={{fontSize: 30, fontWeight: 800, color: NOTE.muted}}>{fmt(total)}{unit} 중</div>
          <div style={{fontSize: 96, fontWeight: 900, letterSpacing: -2, color: current === stages.length - 1 ? tone.ink : NOTE.ink,
            fontVariantNumeric: "tabular-nums"}}>{fmt(value)}<span style={{fontSize: 52}}>{unit}</span></div>
        </div>
        <div style={{position: "absolute", top: 152, left: 0, right: 0, textAlign: "center", fontSize: 40, fontWeight: 800,
          color: labelColor}}>{label}</div>
        {/* the grid */}
        <svg width={860} height={GRID_H + 20} style={{position: "absolute", left: 0, top: 218, opacity: gridIn}}>
          {Array.from({length: D}, (_, i) => {
            const rank = order[i];
            let k = -1;
            let at = 0;
            counts.forEach((n, s) => {
              const t0 = beats[s] + delay[i];
              if (rank < n && frame >= t0) {
                k = s;
                at = t0;
              }
            });
            const pop = k >= 0 ? spr(frame, at, 8, 0.2) : 1;
            const c = k >= 0 ? colors[k] : NOTE.rule;
            const x = gx + (i % cols) * pitch + pitch / 2;
            const y = 10 + Math.floor(i / cols) * pitch + pitch / 2;
            return <circle key={i} cx={x} cy={y} r={r0 * (k >= 0 ? 0.7 + 0.3 * Math.min(1.3, pop) : 0.9)} fill={c} />;
          })}
        </svg>
        {/* legend */}
        <div style={{position: "absolute", left: 40, right: 40, bottom: 26, display: "flex", flexWrap: "wrap",
          justifyContent: "center", columnGap: 30, rowGap: 6, fontSize: 28, fontWeight: 800, color: NOTE.muted}}>
          {stages.map((s, k) => (
            <div key={k} style={{display: "flex", alignItems: "center", gap: 10, opacity: interpolate(frame, [beats[k], beats[k] + 8], [0, 1], clamp)}}>
              <div style={{width: 20, height: 20, borderRadius: "50%", background: colors[k]}} />
              {s.label} {fmt(s.count)}{unit}
            </div>
          ))}
          {per > 1 ? <div>● 1개 = {fmt(per)}{unit}</div> : null}
        </div>
      </NoteCard>
    </SceneShell>
  );
};
