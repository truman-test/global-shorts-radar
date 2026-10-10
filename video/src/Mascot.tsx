// "도치": the channel's mascot, a small hedgehog. Its defence (spikes up, curl into a ball) is the channel's
// message: spot the danger, protect yourself. Our own flat design for the paper stage: warm-brown scalloped spiky
// back, cream face and belly, black nose, dot eyes with a highlight, tiny feet and paws, ink outline.
// One SVG rig driven by plain numbers (position, squash, tilt, look, blink, bristle, curl, expression, paw), every
// value a pure function of the frame. It stands in the page margin (the layouts give it room when it is on) or on
// the explainer card's corner, reacts to what each scene shows, and hops or waddles from one spot to the next.
import React from "react";
import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {checklistRowY} from "./ChecklistScene";
import {flowNodeCenters} from "./FlowScene";
import {bodyBox} from "./kit";
import {spr} from "./motion";
import {ALERT_LAND, chatBeats, checklistTicks, compareBeats, dotBeats, flowBeats, SMS_FLAG, STAT_COUNT,
  timelineBeats, TOGGLE_CIRCLE, toggleTaps} from "./schedule";
import {toggleRowY} from "./ToggleScene";
import {Theme, useTheme} from "./themes";
import {SceneProps, ShortProps} from "./types";

export type Expr = "neutral" | "alarmed" | "worried" | "curious" | "happy";
export type Paw = "none" | "point" | "pencil" | "cheer";

export type Pose = {
  x: number; // centre of the feet
  y: number; // feet line
  size: number; // body width
  lookX: number; // pupils, -1..1
  lookY: number;
  expr: Expr;
  paw: Paw;
  pawAngle: number; // degrees, 0 = pointing right, positive = down
  tilt: number; // degrees
  bristle: number; // 0 relaxed .. 1 spikes up
  shiver: number; // 0..1 trembling
  curl: number; // 0 standing .. 1 rolled into a spiky ball
  sweat: boolean;
  sy: number; // squash (< 1) / stretch (> 1)
  lift: number; // px above the feet line
  walk: number; // waddle phase (radians), 0 = standing
  clipY?: number; // hide everything below this y (peeking up from behind a card edge)
  opacity: number;
};

const INK = "#2B2620";
const SPIKE = "#94653F";
const SPIKE_DARK = "#7A5132";
const FACE = "#F7E6C8";
const EAR = "#E9B99A";
const SWEAT = "#8CC8FF";

/* ------------------------------------------------------------------ motion primitives */

/**
 * A hop at `at` (scene-local frames) lasting `dur`: 5 frames of anticipation (squash down), a stretched take-off,
 * a parabolic arc (u = progress 0..1, lift = height), then a squash on landing that springs back.
 */
export const hop = (f: number, at: number, dur = 12, height = 60) => {
  const t = f - at;
  if (t < -5) return {u: 0, lift: 0, sy: 1, active: false};
  if (t < 0) {
    const a = (t + 5) / 5;
    return {u: 0, lift: 0, sy: 1 - 0.14 * Math.sin((a * Math.PI) / 2), active: true};
  }
  if (t < dur) {
    const u = t / dur;
    const lift = 4 * u * (1 - u) * height;
    const stretch = 1 + 0.13 * Math.abs(Math.cos(u * Math.PI)) * (u < 0.5 ? 1 : 0.7);
    return {u: u * u * (3 - 2 * u), lift, sy: stretch, active: true};
  }
  const s = t - dur;
  return {u: 1, lift: 0, sy: 1 - 0.13 * Math.exp(-s / 3.2) * Math.cos(s * 0.75), active: s < 14};
};

/** Strong danger: curls into a ball over 5 frames at `at`, holds ~0.5 s, uncurls over 8 (then peeks). */
const curlAt = (f: number, at: number) =>
  f < at ? 0 : f < at + 5 ? (f - at) / 5 : f < at + 20 ? 1 : Math.max(0, 1 - (f - at - 20) / 8);

/** Blink amount 0..1 (two staggered rhythms). */
const blinkAt = (frame: number) => {
  const a = frame % 97;
  const b = (frame + 41) % 151;
  const one = (k: number) => (k < 5 ? Math.sin((k / 5) * Math.PI) : 0);
  return Math.max(one(a), one(b));
};

/* ------------------------------------------------------------------ the rig */

type Pt = [number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The spiky back: a zigzag along the body ellipse from angle a0 to a1 (radians, SVG y-down), tips at 1 + L. */
const spikePath = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number, L: number,
  jitter: (k: number) => number): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= n * 2; i++) {
    const a = a0 + ((a1 - a0) * i) / (n * 2);
    const r = i % 2 ? 1 + L + jitter(i) : 1;
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return pts;
};

export const Dochi: React.FC<{pose: Pose; blink: number; frame: number}> = ({pose, blink, frame}) => {
  const S = pose.size;
  const c = Math.min(1, Math.max(0, pose.curl));
  const sy = pose.sy;
  const sx = 1 + (1 - sy) * 0.8;
  const lw = Math.max(3, S * 0.026);
  const pad = S * 1.1;
  // body: an egg lying on its feet, rounding into a ball as it curls
  const cx = lerp(-0.03 * S, 0, c);
  const cy = lerp(-0.4 * S, -0.36 * S, c);
  const rx = lerp(0.47 * S, 0.37 * S, c);
  const ry = lerp(0.38 * S, 0.36 * S, c);
  const L = (pose.expr === "happy" ? 0.16 : 0.22) + 0.14 * pose.bristle + 0.08 * c;
  const a0 = lerp(-1.05, -0.3, c); // spikes start a little in front of the top...
  const a1 = lerp(-3.55, -0.3 - 2 * Math.PI, c); // ...run over the back down to the rear (all round when curled)
  const shake = (k: number) => (pose.shiver > 0 ? Math.sin(frame * 2.7 + k * 1.9) * 0.035 * pose.shiver : 0);
  const outer = spikePath(cx, cy, rx, ry, a0, a1, c > 0.5 ? 16 : 10, L, shake);
  // close the body along the front/belly (r = 1) back to the start
  const close: Pt[] = [];
  if (c < 0.98) {
    const steps = 18;
    for (let i = 1; i < steps; i++) {
      const a = a1 + ((a0 + 2 * Math.PI - a1) * i) / steps;
      close.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
  }
  const body = "M" + [...outer, ...close].map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L") + " Z";
  const face = 1 - Math.min(1, c * 1.6); // the face tucks in first and comes out last (peeking)
  const big = pose.expr === "alarmed";
  const eyeOpen = big ? 1 : Math.max(0.1, 1 - blink);
  const px = pose.lookX * S * 0.012;
  const py = pose.lookY * S * 0.012;
  const eyes: Pt[] = [[0.22 * S, -0.5 * S], [0.37 * S, -0.505 * S]];
  const step = Math.sin(pose.walk);

  const paw = (() => {
    if (pose.paw === "none" || face < 0.5) return null;
    const ox = 0.34 * S; // the paw comes out of the front of the belly
    const oy = -0.2 * S;
    const ang = (pose.pawAngle * Math.PI) / 180;
    const len = S * (pose.paw === "pencil" ? 0.18 : pose.paw === "cheer" ? 0.17 : 0.22);
    const ex = ox + Math.cos(ang) * len;
    const ey = oy + Math.sin(ang) * len;
    return (
      <g>
        <path d={`M${ox} ${oy} L${ex} ${ey}`} stroke={INK} strokeWidth={lw * 2.6} strokeLinecap="round" />
        <path d={`M${ox} ${oy} L${ex} ${ey}`} stroke={FACE} strokeWidth={lw * 1.3} strokeLinecap="round" />
        {pose.paw === "pencil" ? (
          <g transform={`translate(${ex} ${ey}) rotate(${pose.pawAngle + 35})`}>
            <rect x={-S * 0.03} y={-S * 0.024} width={S * 0.22} height={S * 0.05} rx={S * 0.01} fill="#F59E2B"
              stroke={INK} strokeWidth={lw * 0.6} />
            <path d={`M${S * 0.19} ${-S * 0.024} L${S * 0.26} ${S * 0.001} L${S * 0.19} ${S * 0.026} Z`} fill="#F6D7AE"
              stroke={INK} strokeWidth={lw * 0.6} strokeLinejoin="round" />
            <circle cx={S * 0.25} cy={S * 0.001} r={S * 0.011} fill={INK} />
          </g>
        ) : null}
      </g>
    );
  })();

  const mouth = (() => {
    const mx = 0.43 * S;
    const my = -0.355 * S;
    switch (pose.expr) {
      case "happy": return <path d={`M${mx - 0.07 * S} ${my - 0.01 * S} Q${mx} ${my + 0.07 * S} ${mx + 0.06 * S} ${my - 0.02 * S}`} />;
      case "alarmed": return <ellipse cx={mx} cy={my + 0.012 * S} rx={0.026 * S} ry={0.034 * S} fill={INK} />;
      case "worried": return <path d={`M${mx - 0.06 * S} ${my + 0.02 * S} Q${mx - 0.02 * S} ${my - 0.025 * S} ${mx + 0.02 * S} ${my + 0.01 * S} T${mx + 0.07 * S} ${my}`} />;
      default: return <path d={`M${mx - 0.045 * S} ${my} Q${mx} ${my + 0.03 * S} ${mx + 0.045 * S} ${my}`} />;
    }
  })();

  const clip = pose.clipY !== undefined ? `dochi${Math.round(pose.x)}${Math.round(pose.clipY)}` : undefined;
  return (
    <svg style={{position: "absolute", left: pose.x - pad, top: pose.y - pad * 1.6, overflow: "visible",
      opacity: pose.opacity, pointerEvents: "none"}} width={pad * 2} height={pad * 2}>
      {clip ? (
        <defs>
          <clipPath id={clip} clipPathUnits="userSpaceOnUse">
            <rect x={-pad * 2} y={-pad * 4} width={pad * 6} height={pose.clipY! - (pose.y - pad * 1.6) + pad * 4} />
          </clipPath>
        </defs>
      ) : null}
      <g clipPath={clip ? `url(#${clip})` : undefined}>
        <ellipse cx={pad} cy={pad * 1.6 + 3} rx={S * 0.44 * Math.max(0.4, 1 - pose.lift / 200)} ry={S * 0.05}
          fill="rgba(60,40,10,0.16)" />
        <g transform={`translate(${pad + Math.sin(frame * 3.1) * 3 * pose.shiver} ${pad * 1.6 - pose.lift})
          rotate(${pose.tilt + step * 3}) scale(${sx} ${sy})`}>
          {/* feet (waddle: one lifts while the body rocks) */}
          {c < 0.6 ? [[-0.2, 1], [0.17, -1]].map(([fx, ph], k) => (
            <ellipse key={k} cx={fx * S} cy={-0.012 * S - Math.max(0, step * ph) * 0.04 * S} rx={0.075 * S} ry={0.04 * S}
              fill={SPIKE_DARK} stroke={INK} strokeWidth={lw * 0.8} />
          )) : null}
          {/* back with scalloped spikes + body */}
          <path d={body} fill={SPIKE} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
          {/* a few inner quill lines for texture */}
          <g stroke={SPIKE_DARK} strokeWidth={lw * 0.8} strokeLinecap="round" opacity={0.8}>
            {[-2.2, -2.6, -3.0].map((a, k) => (
              <path key={k} d={`M${cx + Math.cos(a) * rx * 0.55} ${cy + Math.sin(a) * ry * 0.55} L${cx + Math.cos(a - 0.12) * rx * 0.82}
                ${cy + Math.sin(a - 0.12) * ry * 0.82}`} />
            ))}
          </g>
          {/* face and belly, tucked away while curled */}
          <g opacity={face} transform={`translate(${0.1 * S * (1 - face)} ${0.06 * S * (1 - face)}) scale(${0.6 + 0.4 * face})`}>
            <ellipse cx={0.04 * S} cy={-0.69 * S} rx={0.06 * S} ry={0.055 * S} fill={EAR} stroke={INK} strokeWidth={lw * 0.8} />
            <path d={`M${0.0 * S} ${-0.64 * S} C${0.2 * S} ${-0.68 * S} ${0.34 * S} ${-0.58 * S} ${0.52 * S} ${-0.45 * S}
              C${0.58 * S} ${-0.41 * S} ${0.55 * S} ${-0.35 * S} ${0.48 * S} ${-0.33 * S}
              C${0.42 * S} ${-0.25 * S} ${0.36 * S} ${-0.08 * S} ${0.12 * S} ${-0.03 * S}
              C${-0.04 * S} ${-0.06 * S} ${-0.09 * S} ${-0.3 * S} ${-0.04 * S} ${-0.45 * S}
              C${-0.02 * S} ${-0.55 * S} ${-0.03 * S} ${-0.6 * S} ${0.0 * S} ${-0.64 * S} Z`}
              fill={FACE} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
            <ellipse cx={0.545 * S} cy={-0.415 * S} rx={0.04 * S} ry={0.033 * S} fill={INK} />
            <circle cx={0.535 * S} cy={-0.425 * S} r={0.01 * S} fill="#fff" opacity={0.8} />
            {pose.expr === "happy" ? <ellipse cx={0.3 * S} cy={-0.39 * S} rx={0.045 * S} ry={0.028 * S} fill="#FF9F8A" opacity={0.65} /> : null}
            {eyes.map(([ex, ey], k) => (
              <g key={k}>
                {big ? <circle cx={ex} cy={ey} r={0.05 * S} fill="#fff" stroke={INK} strokeWidth={lw * 0.7} /> : null}
                {pose.expr === "happy" && blink < 0.5 ? (
                  <path d={`M${ex - 0.03 * S} ${ey + 0.006 * S} Q${ex} ${ey - 0.035 * S} ${ex + 0.03 * S} ${ey + 0.006 * S}`}
                    stroke={INK} strokeWidth={lw} fill="none" strokeLinecap="round" />
                ) : (
                  <>
                    <ellipse cx={ex + px} cy={ey + py} rx={0.028 * S} ry={0.033 * S * eyeOpen} fill={INK} />
                    {eyeOpen > 0.5 ? <circle cx={ex + px - 0.009 * S} cy={ey + py - 0.012 * S} r={0.009 * S} fill="#fff" /> : null}
                  </>
                )}
                {pose.expr === "worried" ? (
                  <path d={`M${ex - 0.035 * S} ${ey - 0.06 * S - (k ? 0 : 0.012 * S)} L${ex + 0.035 * S} ${ey - 0.06 * S - (k ? 0.012 * S : 0)}`}
                    stroke={INK} strokeWidth={lw * 0.8} strokeLinecap="round" />
                ) : null}
              </g>
            ))}
            <g stroke={INK} strokeWidth={lw * 0.9} fill="none" strokeLinecap="round">{mouth}</g>
            {paw}
          </g>
          {pose.sweat ? (
            <path d={`M${0.5 * S} ${-0.78 * S} q-${0.045 * S} ${0.07 * S} -${0.045 * S} ${0.1 * S} a${0.045 * S} ${0.045 * S} 0 0 0 ${0.09 * S} 0 q0 -${0.03 * S} -${0.045 * S} -${0.1 * S} Z`}
              fill={SWEAT} stroke={INK} strokeWidth={lw * 0.6} />
          ) : null}
        </g>
      </g>
    </svg>
  );
};

/* ------------------------------------------------------------------ where 도치 stands and how it reacts */

export const SIZE = 166; // ~15% of the frame width (body; ~19% with the snout and quills)
const MARGIN_X = 114; // centre of the margin the layouts leave free (x ~16-196) when 도치 is on
const CARD_SPOT = {x: 182, y: 712, size: 176}; // on the explainer card's top-left corner
export const FEET_MIN = 700; // never higher than this (the header card ends at 502)
const FEET_MAX = 1232; // never into the caption band (starts at 1255)

const base = (x: number, y: number, size = SIZE): Pose => ({x, y: Math.min(FEET_MAX, Math.max(FEET_MIN, y)), size,
  lookX: 0.8, lookY: 0, expr: "neutral", paw: "none", pawAngle: 0, tilt: 0, bristle: 0, shiver: 0, curl: 0,
  sweat: false, sy: 1, lift: 0, walk: 0, opacity: 1});

const withHop = (p: Pose, h: ReturnType<typeof hop>): Pose => ({...p, sy: p.sy * h.sy, lift: p.lift + h.lift});

/** Danger reaction from frame `at`: spikes bristle with a short shiver, wide eyes, sweat; `strong` also curls. */
const alarm = (p: Pose, f: number, at: number, strong: boolean): Pose => {
  if (f < at) return p;
  const t = f - at;
  const curl = strong ? curlAt(f, at + 4) : 0;
  return {...p, expr: curl > 0.3 ? p.expr : "alarmed", bristle: Math.min(1, t / 3), shiver: t < 16 ? 1 - t / 16 : 0,
    sweat: true, curl, lookX: 0.4, tilt: -4};
};

/** Calm down after an alarm: worried, spikes settle. */
const settle = (p: Pose, f: number, at: number): Pose =>
  f < at ? p : {...p, expr: "worried", bristle: Math.max(0, 0.6 - (f - at) / 30), shiver: 0, sweat: true};

const happy = (p: Pose): Pose => ({...p, expr: "happy", bristle: 0, sweat: false});

/** The pose at scene-local frame f (f includes the poster lead for the first scene). */
export const scenePose = (scene: SceneProps, f: number, fps: number, first = false): Pose => {
  const mx = MARGIN_X;
  switch (scene.layout) {
    case "card": {
      // first scene: peeks up from behind the card's corner; then sits on it looking at the headline
      const rise = first ? spr(f, 3, 11, 0.04) : 1;
      let p = base(CARD_SPOT.x, CARD_SPOT.y + (1 - Math.min(1, rise)) * 150, CARD_SPOT.size);
      p.clipY = rise < 0.97 ? CARD_SPOT.y : undefined;
      p.lookY = 0.6;
      const react = 6 + scene.headline.split(" ").length * 2; // the key phrase has landed
      if (scene.accent === "red") {
        p = alarm(p, f, react, false);
        p = {...settle(p, f, react + 36), curl: curlAt(f, react + 36 + (first ? 6 : 0))};
      } else if (scene.accent === "yellow") {
        if (f >= react) p = {...p, expr: "worried", sweat: true};
      } else if (scene.accent === "green") {
        if (f >= react) p = withHop(happy(p), hop(f, react, 9, 26));
      } else if (f >= react) {
        p = {...p, expr: "curious", paw: "point", pawAngle: 28};
      }
      return p;
    }
    case "call": {
      let p = base(mx, 1232);
      p.lookY = -0.6;
      p = alarm(p, f, 0, false);
      if (f > 44) p = settle(p, f, 44);
      return p;
    }
    case "alert":
    case "sms": {
      const at = scene.layout === "alert" ? ALERT_LAND - 2 : SMS_FLAG - 2;
      let p = base(mx, 1196);
      p.lookY = -0.7;
      p = alarm(p, f, at, true); // the suspicious item: spikes up, then a quick curl into a ball
      return settle(p, f, at + 40);
    }
    case "chat": {
      const beats = chatBeats(scene, fps).map((b) => b.showAt);
      let p = base(mx, 1196);
      p.lookY = -0.3;
      const last = beats[beats.length - 1] ?? 1e9;
      if (f >= last) p = {...p, expr: "worried", sweat: true, bristle: 0.4};
      return withHop(p, hop(f, last, 9, 24));
    }
    case "stat": {
      let p = base(mx, 1040);
      p.lookY = -0.5;
      const at = STAT_COUNT[1];
      if (scene.accent === "red") p = settle(alarm(p, f, at - 2, false), f, at + 30);
      else if (scene.accent === "green" && f >= at) p = withHop(happy(p), hop(f, at, 9, 30));
      else if (f >= at) p = {...p, expr: "curious"};
      return p;
    }
    case "timeline": {
      const beats = timelineBeats(scene, fps);
      const k = beats.reduce((c, at, i) => (f >= at ? i : c), 0);
      const p = base(mx, 780 + k * 150);
      p.expr = "curious";
      p.lookY = -0.2;
      return withHop(p, hop(f, beats[k] - 8, 8, 30));
    }
    case "checklist": {
      // walks the margin row by row with a pencil, ticks each item, ends relieved
      const ticks = checklistTicks(scene, fps);
      const n = ticks.length;
      const feet = (k: number) => checklistRowY(scene, k) + SIZE * 0.4;
      let y = feet(0);
      let h: ReturnType<typeof hop> = {u: 0, lift: 0, sy: 1, active: false};
      ticks.forEach((at, k) => {
        if (k === 0 || f < at - 12) return;
        const hk = hop(f, at - 12, 9, 30);
        y = feet(k - 1) + (feet(k) - feet(k - 1)) * hk.u;
        h = hk;
      });
      let p = base(mx, y);
      p.paw = "pencil";
      const tick = ticks.reduce((c, at) => (f >= at - 1 && f < at + 8 ? at : c), -1);
      p.pawAngle = -10 + (tick >= 0 ? Math.sin(((f - tick) / 8) * Math.PI * 2) * 16 : 0);
      p.lookY = 0.2;
      p.expr = "curious";
      const done = n ? ticks[n - 1] + 10 : 1e9;
      if (f >= done) p = {...happy(p), paw: "cheer", pawAngle: -50};
      const final = hop(f, done, 11, 50);
      return withHop(withHop(p, h), f >= done - 5 ? final : {u: 0, lift: 0, sy: 1, active: false});
    }
    case "compare": {
      const [b0, b1, b2] = compareBeats(scene, fps);
      let p = base(mx, 1196);
      p.lookY = -0.4;
      if (f >= b0) p = {...p, expr: "happy"};
      if (f >= b1) {
        // recoils from the fake card: leans back, spikes up, sweat
        const r = Math.min(1, spr(f, b1, 8, 0.1));
        p = alarm(p, f, b1, false);
        p = {...p, tilt: -12 * r, x: p.x - 8 * r};
      }
      return f >= b2 ? settle(p, f, b2) : p;
    }
    case "toggle": {
      const taps = toggleTaps(scene, fps);
      const flip = taps[taps.length - 1];
      let p = base(mx, toggleRowY(scene) + SIZE * 0.45);
      p.expr = "curious";
      if (f >= flip - 10) p = {...p, paw: "point", pawAngle: -6};
      if (f >= flip + TOGGLE_CIRCLE) p = {...happy(p), paw: "cheer", pawAngle: -50};
      return withHop(p, hop(f, flip + TOGGLE_CIRCLE - 4, 10, 40));
    }
    case "flow": {
      // hops down the margin beside the chart, node by node
      const ys = flowNodeCenters(scene, bodyBox(true).width).map((y) => y + SIZE * 0.4);
      const beats = flowBeats(scene, fps);
      let y = ys[0] ?? 900;
      let h: ReturnType<typeof hop> = {u: 0, lift: 0, sy: 1, active: false};
      beats.forEach((at, k) => {
        if (k === 0 || f < at - 10) return;
        const hk = hop(f, at - 10, 10, 40);
        y = ys[k - 1] + (ys[k] - ys[k - 1]) * hk.u;
        h = hk;
      });
      let p = base(mx, y);
      p.expr = "curious";
      if (beats.length && f >= beats[beats.length - 1] + 6) {
        p = scene.accent === "red" ? {...p, expr: "worried"} : happy(p);
      }
      return withHop(p, h);
    }
    case "dots": {
      const beats = dotBeats(scene, fps);
      let p = base(mx, 820);
      p.lookY = -0.3;
      const last = beats[beats.length - 1] ?? 1e9;
      if (f >= (beats[0] ?? 1e9)) p = {...p, expr: "curious"};
      if (f >= last) p = scene.accent === "green" ? happy(p) : settle(alarm(p, f, last, false), f, last + 24);
      return p;
    }
    default:
      return base(mx, 1196);
  }
};

/** Is 도치 on in this scene? The script's `mascot` wins; by default on paper stages, off on dark ones. */
export const mascotOn = (scene: SceneProps, theme: Theme) => scene.mascot ?? theme.family === "paper";

const MOVE = 14; // frames for the move from one scene's spot to the next

/**
 * 도치 across the whole video: each scene's pose, with a hop (or a waddle when the spots are level) from the
 * previous scene's spot at every boundary, a pop-in/out where a scene turns it off, and the opening pose again in
 * the poster tail.
 */
export const MascotTrack: React.FC<{props: ShortProps; spans: {from: number; frames: number}[]; poster: number}> = ({
  props, spans, poster,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const theme = useTheme();
  const n = props.scenes.length;
  if (!n) return null;
  const end = spans[n - 1].from + spans[n - 1].frames;
  const local = (i: number, f: number) => f - spans[i].from + (i === 0 ? poster : 0);
  const poseAt = (i: number, f: number) => scenePose(props.scenes[i], local(i, f), fps, i === 0);
  let pose: Pose | null;
  if (frame >= end) {
    pose = mascotOn(props.scenes[0], theme) ? scenePose(props.scenes[0], poster, fps, true) : null;
  } else {
    let i = spans.findIndex((s) => frame < s.from + s.frames);
    if (i < 0) i = n - 1;
    const on = mascotOn(props.scenes[i], theme);
    const prevOn = i > 0 && mascotOn(props.scenes[i - 1], theme);
    const t = frame - spans[i].from;
    if (!on) {
      pose = prevOn && t < 8 ? {...poseAt(i - 1, spans[i].from - 1), opacity: 1 - t / 8} : null;
    } else if (i > 0 && t < MOVE) {
      const to = poseAt(i, frame);
      if (prevOn) {
        const from = poseAt(i - 1, spans[i].from - 1);
        const level = Math.abs(to.y - from.y) < 40;
        const h = hop(t, 0, MOVE - 2, level ? 18 : Math.max(50, Math.abs(to.y - from.y) * 0.22 + 40));
        pose = {...to, x: from.x + (to.x - from.x) * h.u, y: from.y + (to.y - from.y) * h.u, sy: h.sy, lift: h.lift,
          curl: 0, bristle: 0, shiver: 0, walk: level ? t * 0.9 : 0, clipY: t > MOVE - 3 ? to.clipY : undefined,
          size: from.size + (to.size - from.size) * h.u};
      } else {
        const s = spr(t, 0, 10, 0.08);
        pose = {...to, opacity: Math.min(1, s * 1.5), sy: to.sy * (0.6 + 0.4 * s)};
      }
    } else {
      pose = poseAt(i, frame);
    }
  }
  if (!pose) return null;
  // breathing: a slow squash/stretch and bob while standing
  const breathe = pose.lift > 0 || pose.curl > 0 ? 0 : Math.sin(frame / 16);
  return <Dochi pose={{...pose, y: pose.y - breathe * 2, sy: pose.sy * (1 + 0.018 * breathe),
    opacity: interpolate(pose.opacity, [0, 1], [0, 1])}} blink={blinkAt(frame)} frame={frame} />;
};
