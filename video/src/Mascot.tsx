// "노트": the channel's own mascot, a small yellow sticky note with a folded corner, two dot eyes and a line mouth.
// One SVG rig driven by plain numbers (position, squash, tilt, look, blink, expression, arm), every value a pure
// function of the frame. It lives in the page margin of the paper stage and reacts to what each scene shows,
// hopping (anticipation -> stretch -> squash) from one spot to the next, so the episode reads as one journey.
import React from "react";
import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {flowNodeCenters} from "./FlowScene";
import {checklistRowY} from "./ChecklistScene";
import {spr} from "./motion";
import {ALERT_LAND, chatBeats, checklistTicks, compareBeats, dotBeats, flowBeats, SMS_ARRIVE, SMS_FLAG, STAT_COUNT,
  timelineBeats, TOGGLE_CIRCLE, toggleTaps} from "./schedule";
import {toggleRowY} from "./ToggleScene";
import {Theme, useTheme} from "./themes";
import {SceneProps, ShortProps} from "./types";

export type Expr = "neutral" | "surprised" | "worried" | "happy";
export type Arm = "none" | "point" | "pencil" | "cheer";

export type Pose = {
  x: number; // centre of the feet line
  y: number; // feet line (bottom of the note)
  size: number; // note width
  lookX: number; // pupils, -1..1
  lookY: number;
  expr: Expr;
  arm: Arm;
  armAngle: number; // degrees, 0 = pointing right, positive = down
  tilt: number; // degrees
  sweat: boolean;
  marks: boolean; // little shock lines over the head
  sy: number; // vertical squash (< 1) / stretch (> 1)
  lift: number; // px above the feet line (a hop)
  clipY?: number; // hide everything below this y (peeking from behind a card edge)
  opacity: number;
};

const INK = "#2B2620";
const BODY = "#FFD43B";
const GLUE = "#F2C21B";
const FLAP = "#E3AE0E";
const SWEAT = "#8CC8FF";

/* ------------------------------------------------------------------ motion primitives */

/**
 * A hop at `at` (scene-local frames) lasting `dur`: 5 frames of anticipation (squash down), a stretched take-off,
 * a parabolic arc (u = horizontal progress 0..1, lift = height), then a squash on landing that springs back.
 */
export const hop = (f: number, at: number, dur = 12, height = 60) => {
  const t = f - at;
  if (t < -5) return {u: 0, lift: 0, sy: 1, active: false};
  if (t < 0) {
    const a = (t + 5) / 5;
    return {u: 0, lift: 0, sy: 1 - 0.16 * Math.sin((a * Math.PI) / 2), active: true};
  }
  if (t < dur) {
    const u = t / dur;
    const lift = 4 * u * (1 - u) * height;
    const stretch = 1 + 0.16 * Math.abs(Math.cos(u * Math.PI)) * (u < 0.5 ? 1 : 0.7);
    return {u: u * u * (3 - 2 * u), lift, sy: stretch, active: true};
  }
  const s = t - dur;
  return {u: 1, lift: 0, sy: 1 - 0.15 * Math.exp(-s / 3.2) * Math.cos(s * 0.75), active: s < 14};
};

/** Blink amount 0..1 (two staggered rhythms, never in step with the bob). */
const blinkAt = (frame: number) => {
  const a = frame % 97;
  const b = (frame + 41) % 151;
  const one = (k: number) => (k < 5 ? Math.sin((k / 5) * Math.PI) : 0);
  return Math.max(one(a), one(b));
};

/* ------------------------------------------------------------------ the rig */

export const NoteMascot: React.FC<{pose: Pose; blink: number; seed?: number}> = ({pose, blink}) => {
  const S = pose.size;
  const H = S * 0.92;
  const sy = pose.sy;
  const sx = 1 + (1 - sy) * 0.85;
  const lw = Math.max(3, S * 0.05);
  const eyeY = -H * 0.56;
  const eyeDX = S * 0.19;
  const big = pose.expr === "surprised";
  const px = pose.lookX * S * 0.05;
  const py = pose.lookY * S * 0.04;
  const eyeOpen = big ? 1 : Math.max(0.08, 1 - blink);
  const mouthY = -H * 0.3;
  const fold = S * 0.24;
  const pad = S * 0.9;
  const clip = pose.clipY !== undefined ? `m${Math.round(pose.x)}${Math.round(pose.clipY)}` : undefined;

  const mouth = (() => {
    const w = S * 0.11;
    switch (pose.expr) {
      case "happy": return <path d={`M${-w * 1.2} ${mouthY - 2} Q0 ${mouthY + S * 0.13} ${w * 1.2} ${mouthY - 2}`} />;
      case "surprised": return <ellipse cx={0} cy={mouthY + 2} rx={S * 0.06} ry={S * 0.08} fill={INK} />;
      case "worried": return <path d={`M${-w} ${mouthY + 6} Q${-w / 2} ${mouthY - 4} 0 ${mouthY + 3} T${w} ${mouthY}`} />;
      default: return <path d={`M${-w * 0.8} ${mouthY} L${w * 0.8} ${mouthY}`} />;
    }
  })();

  const arm = (() => {
    if (pose.arm === "none") return null;
    const sxA = S / 2 - lw;
    const syA = -H * 0.42;
    const ang = (pose.armAngle * Math.PI) / 180;
    const L = S * (pose.arm === "pencil" ? 0.42 : 0.5);
    const ex = sxA + Math.cos(ang) * L;
    const ey = syA + Math.sin(ang) * L;
    const elbow = `Q${sxA + Math.cos(ang - 0.5) * L * 0.55} ${syA + Math.sin(ang - 0.5) * L * 0.55} ${ex} ${ey}`;
    const other = pose.arm === "cheer"
      ? <path d={`M${-sxA} ${syA} Q${-sxA - S * 0.2} ${syA - S * 0.2} ${-sxA - S * 0.26} ${syA - S * 0.44}`} />
      : null;
    return (
      <g stroke={INK} strokeWidth={lw} fill="none" strokeLinecap="round">
        <path d={`M${sxA} ${syA} ${elbow}`} />
        {other}
        {pose.arm === "pencil" ? (
          <g transform={`translate(${ex} ${ey}) rotate(${pose.armAngle + 30})`}>
            <rect x={-S * 0.04} y={-S * 0.03} width={S * 0.3} height={S * 0.09} rx={S * 0.015} fill="#F59E2B" />
            <path d={`M${S * 0.26} ${-S * 0.03} L${S * 0.36} ${S * 0.015} L${S * 0.26} ${S * 0.06} Z`} fill="#F6D7AE" />
            <circle cx={S * 0.345} cy={S * 0.015} r={S * 0.018} fill={INK} stroke="none" />
          </g>
        ) : (
          <circle cx={ex} cy={ey} r={lw * 0.9} fill={INK} />
        )}
      </g>
    );
  })();

  return (
    <svg style={{position: "absolute", left: pose.x - pad, top: pose.y - pad * 1.7, overflow: "visible",
      opacity: pose.opacity, pointerEvents: "none"}} width={pad * 2} height={pad * 2}>
      {clip ? (
        <defs>
          <clipPath id={clip} clipPathUnits="userSpaceOnUse">
            <rect x={-pad * 2} y={-pad * 4} width={pad * 6} height={pose.clipY! - (pose.y - pad * 1.7) + pad * 4} />
          </clipPath>
        </defs>
      ) : null}
      <g clipPath={clip ? `url(#${clip})` : undefined}>
        {/* soft contact shadow on the page, smaller while in the air */}
        <ellipse cx={pad} cy={pad * 1.7 + 4} rx={S * 0.42 * Math.max(0.4, 1 - pose.lift / 160)} ry={S * 0.07}
          fill="rgba(60,40,10,0.16)" />
        <g transform={`translate(${pad} ${pad * 1.7 - pose.lift}) rotate(${pose.tilt}) scale(${sx} ${sy})`}>
          {arm}
          {/* the note: glue strip on top, folded bottom-right corner */}
          <path d={`M${-S / 2 + 6} ${-H} L${S / 2 - 6} ${-H} Q${S / 2} ${-H} ${S / 2} ${-H + 6} L${S / 2} ${-fold}
            L${S / 2 - fold} 0 L${-S / 2 + 6} 0 Q${-S / 2} 0 ${-S / 2} -6 L${-S / 2} ${-H + 6} Q${-S / 2} ${-H} ${-S / 2 + 6} ${-H} Z`}
            fill={BODY} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
          <path d={`M${-S / 2 + lw / 2} ${-H + H * 0.18} L${S / 2 - lw / 2} ${-H + H * 0.18}`} stroke={GLUE}
            strokeWidth={H * 0.12} opacity={0.6} />
          <path d={`M${S / 2} ${-fold} L${S / 2 - fold * 0.95} ${-fold * 0.95} L${S / 2 - fold} 0 Z`} fill={FLAP}
            stroke={INK} strokeWidth={lw * 0.8} strokeLinejoin="round" />
          {/* eyes */}
          {[-1, 1].map((s) => (
            <g key={s}>
              {big ? <circle cx={s * eyeDX} cy={eyeY} r={S * 0.1} fill="#fff" stroke={INK} strokeWidth={lw * 0.7} /> : null}
              <ellipse cx={s * eyeDX + px} cy={eyeY + py} rx={S * (big ? 0.045 : 0.06)}
                ry={S * (big ? 0.045 : 0.06) * eyeOpen} fill={INK} />
              {pose.expr === "worried" ? (
                <path d={`M${s * eyeDX - S * 0.08} ${eyeY - S * 0.1 - (s > 0 ? 0 : 6)} L${s * eyeDX + S * 0.08}
                  ${eyeY - S * 0.1 - (s > 0 ? 6 : 0)}`} stroke={INK} strokeWidth={lw * 0.8} strokeLinecap="round" />
              ) : null}
              {pose.expr === "happy" && blink < 0.5 ? (
                <circle cx={s * S * 0.3} cy={eyeY + S * 0.14} r={S * 0.05} fill="#FF9F8A" opacity={0.7} />
              ) : null}
            </g>
          ))}
          <g stroke={INK} strokeWidth={lw * 0.85} fill="none" strokeLinecap="round">{mouth}</g>
          {pose.sweat ? (
            <path d={`M${S * 0.5 + 8} ${-H * 0.9} q-9 14 -9 21 a9 9 0 0 0 18 0 q0 -7 -9 -21 Z`} fill={SWEAT}
              stroke={INK} strokeWidth={lw * 0.6} />
          ) : null}
          {pose.marks ? (
            <g stroke={INK} strokeWidth={lw * 0.8} strokeLinecap="round">
              <path d={`M${-S * 0.34} ${-H - S * 0.12} L${-S * 0.44} ${-H - S * 0.26}`} />
              <path d={`M0 ${-H - S * 0.14} L0 ${-H - S * 0.32}`} />
              <path d={`M${S * 0.34} ${-H - S * 0.12} L${S * 0.44} ${-H - S * 0.26}`} />
            </g>
          ) : null}
        </g>
      </g>
    </svg>
  );
};

/* ------------------------------------------------------------------ where 노트 stands and how it reacts */

export const GUTTER = {x: 58, y: 1196, size: 86}; // the page margin, left of every panel and card
const CARD_EDGE = {x: 198, y: 712, size: 118}; // sitting on the poster/explainer note card's top edge

const base = (x: number, y: number, size: number): Pose => ({x, y, size, lookX: 0.8, lookY: 0.2, expr: "neutral",
  arm: "none", armAngle: 0, tilt: 0, sweat: false, marks: false, sy: 1, lift: 0, opacity: 1});

/** Apply an in-place hop (squash/stretch + lift) to a pose. */
const withHop = (p: Pose, h: ReturnType<typeof hop>): Pose => ({...p, sy: p.sy * h.sy, lift: p.lift + h.lift});

/** Mood that matches a scene's tone (red = 위험, yellow = 주의, green = 안전, blue = info). */
const toneExpr = (scene: SceneProps): Expr =>
  scene.accent === "red" ? "surprised" : scene.accent === "yellow" ? "worried" : scene.accent === "green" ? "happy"
    : "neutral";

/** The mascot's pose at scene-local frame f (f already includes the poster lead for the first scene). */
export const scenePose = (scene: SceneProps, f: number, fps: number, first = false): Pose => {
  switch (scene.layout) {
    case "card": {
      // peeks up from behind the card's top edge, then sits on it looking at the headline; reacts to its tone
      const rise = first ? spr(f, 4, 12, 0.04) : 1; // later card scenes: it hops straight onto the edge
      const p = base(CARD_EDGE.x, CARD_EDGE.y + (1 - Math.min(1, rise)) * 110, CARD_EDGE.size);
      p.clipY = rise < 0.97 ? CARD_EDGE.y : undefined; // only while it is still coming up from behind the card
      p.lookX = 0.9;
      p.lookY = 0.9;
      const words = scene.headline.split(" ").length;
      const react = 4 + words * 2;
      if (f >= react) {
        p.expr = toneExpr(scene);
        p.marks = scene.accent === "red" && f < react + 30;
        p.arm = scene.accent === "blue" ? "point" : "none";
        p.armAngle = 35;
      }
      return withHop(p, hop(f, react, 9, 26));
    }
    case "call": {
      const p = base(GUTTER.x, GUTTER.y + 40, GUTTER.size);
      p.expr = "surprised";
      p.marks = f < 50;
      p.sweat = f > 20;
      p.lookY = -0.6;
      p.tilt = Math.sin(f * 1.7) * (f < 30 ? 3 : 0); // trembling with the ring
      return withHop(p, hop(f, 6, 10, 46));
    }
    case "alert":
    case "sms": {
      const at = scene.layout === "alert" ? ALERT_LAND - 2 : SMS_FLAG - 2;
      const p = base(GUTTER.x, GUTTER.y, GUTTER.size);
      p.lookY = -0.7;
      if (f >= at) {
        p.expr = f < at + 40 ? "surprised" : "worried";
        p.marks = f < at + 24;
        p.sweat = true;
        p.tilt = -6;
      } else if (scene.layout === "sms" && f < SMS_ARRIVE) {
        p.lookY = -0.2;
      }
      return withHop(p, hop(f, at, 11, 70));
    }
    case "chat": {
      const beats = chatBeats(scene, fps).map((b) => b.showAt);
      const p = base(GUTTER.x, GUTTER.y, GUTTER.size);
      p.lookY = -0.3;
      const last = beats[beats.length - 1] ?? 1e9;
      if (f >= last) {
        p.expr = "worried";
        p.sweat = true;
      }
      return withHop(p, hop(f, last, 9, 30));
    }
    case "stat": {
      const p = base(GUTTER.x, 900, GUTTER.size);
      p.lookY = -0.5;
      const at = STAT_COUNT[1];
      if (f >= at) {
        p.expr = scene.accent === "red" ? (f < at + 30 ? "surprised" : "worried") : toneExpr(scene);
        p.sweat = scene.accent === "red";
      }
      return withHop(p, hop(f, at - 2, 10, 50));
    }
    case "timeline": {
      const beats = timelineBeats(scene, fps);
      const k = beats.reduce((c, at, i) => (f >= at ? i : c), 0);
      const p = base(GUTTER.x, 760 + k * 140, GUTTER.size);
      p.lookY = 0.1;
      return p;
    }
    case "checklist": {
      // walks the margin row by row with a pencil, ticks each item, ends relieved
      const ticks = checklistTicks(scene, fps);
      const n = ticks.length;
      let y = checklistRowY(scene, 0) + GUTTER.size * 0.45;
      let h: ReturnType<typeof hop> = {u: 0, lift: 0, sy: 1, active: false};
      ticks.forEach((at, k) => {
        if (k === 0) return;
        const hk = hop(f, at - 12, 9, 34);
        if (f >= at - 12) {
          const y0 = checklistRowY(scene, k - 1) + GUTTER.size * 0.45;
          const y1 = checklistRowY(scene, k) + GUTTER.size * 0.45;
          y = y0 + (y1 - y0) * hk.u;
          h = hk;
        }
      });
      const p = base(GUTTER.x, y, GUTTER.size);
      p.arm = "pencil";
      const tick = ticks.reduce((c, at) => (f >= at - 1 && f < at + 8 ? at : c), -1);
      p.armAngle = 8 + (tick >= 0 ? Math.sin(((f - tick) / 8) * Math.PI * 2) * 14 : 0);
      p.lookX = 1;
      p.lookY = 0.3;
      const done = n ? ticks[n - 1] + 10 : 1e9;
      if (f >= done) {
        p.expr = "happy";
        p.arm = "cheer";
        p.armAngle = -60;
      }
      const final = hop(f, done, 11, 56);
      return withHop(withHop(p, h), final.active || f >= done ? final : {u: 0, lift: 0, sy: 1, active: false});
    }
    case "compare": {
      const [b0, b1, b2] = compareBeats(scene, fps);
      const p = base(GUTTER.x, GUTTER.y - 40, GUTTER.size);
      p.lookY = -0.4;
      if (f >= b0) p.expr = "happy";
      if (f >= b1) {
        // recoils from the fake card: leans away, eyes wide, a drop of sweat
        const r = Math.min(1, spr(f, b1, 8, 0.1));
        p.expr = f < b2 ? "surprised" : "worried";
        p.tilt = -14 * r;
        p.x -= 10 * r;
        p.marks = f < b1 + 20;
        p.sweat = true;
        p.lookX = 1;
      }
      return withHop(p, hop(f, b0 - 2, 8, 22));
    }
    case "toggle": {
      const taps = toggleTaps(scene, fps);
      const flip = taps[taps.length - 1];
      const p = base(GUTTER.x, toggleRowY(scene) + GUTTER.size * 0.5, GUTTER.size);
      p.lookX = 1;
      if (f >= flip - 8) {
        p.arm = "point";
        p.armAngle = -4;
      }
      if (f >= flip + TOGGLE_CIRCLE) {
        p.expr = "happy";
      }
      return withHop(p, hop(f, flip + TOGGLE_CIRCLE - 4, 10, 40));
    }
    case "flow": {
      // hops down the margin beside the chart, node by node
      const ys = flowNodeCenters(scene).map((y) => y + GUTTER.size * 0.45);
      const beats = flowBeats(scene, fps);
      let y = ys[0] ?? GUTTER.y;
      let h: ReturnType<typeof hop> = {u: 0, lift: 0, sy: 1, active: false};
      beats.forEach((at, k) => {
        if (k === 0 || f < at - 10) return;
        const hk = hop(f, at - 10, 10, 42);
        y = ys[k - 1] + (ys[k] - ys[k - 1]) * hk.u;
        h = hk;
      });
      const p = base(GUTTER.x, y, GUTTER.size);
      p.lookX = 1;
      p.lookY = 0.1;
      if (beats.length && f >= beats[beats.length - 1] + 6) p.expr = toneExpr(scene) === "neutral" ? "happy" : toneExpr(scene);
      return withHop(p, h);
    }
    case "dots": {
      const beats = dotBeats(scene, fps);
      const p = base(GUTTER.x, 740, GUTTER.size);
      p.lookX = 1;
      p.lookY = -0.2;
      const last = beats[beats.length - 1] ?? 1e9;
      if (f >= last) {
        p.expr = scene.accent === "green" ? "happy" : "worried";
        p.sweat = scene.accent !== "green";
      } else if (f >= (beats[0] ?? 1e9)) {
        p.expr = "surprised";
      }
      return withHop(p, hop(f, last, 9, 28));
    }
    default:
      return base(GUTTER.x, GUTTER.y, GUTTER.size);
  }
};

/** Is 노트 on in this scene? The script's `mascot` wins; by default on paper stages, off on dark ones. */
export const mascotOn = (scene: SceneProps, theme: Theme) => scene.mascot ?? theme.family === "paper";

const HOP = 14; // frames for the hop from one scene's spot to the next

/**
 * The mascot across the whole video: each scene's pose, with a hop from the previous scene's spot at every
 * boundary (no cut), a pop-in/out where a scene turns it off, and the opening pose again in the poster tail.
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
      // fade out over the first frames of a scene that has it off
      pose = prevOn && t < 8 ? {...poseAt(i - 1, spans[i].from - 1), opacity: 1 - t / 8} : null;
    } else if (i > 0 && t < HOP) {
      const to = poseAt(i, frame);
      if (prevOn) {
        const from = poseAt(i - 1, spans[i].from - 1);
        const h = hop(t, 0, HOP - 2, Math.max(50, Math.abs(to.y - from.y) * 0.25 + 40));
        pose = {...to, x: from.x + (to.x - from.x) * h.u, y: from.y + (to.y - from.y) * h.u, sy: h.sy, lift: h.lift,
          clipY: t > HOP - 3 ? to.clipY : undefined, size: from.size + (to.size - from.size) * h.u};
      } else {
        const s = spr(t, 0, 10, 0.08);
        pose = {...to, opacity: Math.min(1, s * 1.5), sy: to.sy * (0.6 + 0.4 * s)};
      }
    } else {
      pose = poseAt(i, frame);
    }
  }
  if (!pose) return null;
  const bob = Math.sin(frame / 12) * (pose.lift > 0 ? 0 : 3);
  return <NoteMascot pose={{...pose, y: pose.y - bob, opacity: interpolate(pose.opacity, [0, 1], [0, 1])}}
    blink={blinkAt(frame)} />;
};
