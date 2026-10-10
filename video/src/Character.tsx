// The drama cast (드라마 등장인물): our own flat-vector characters, SD bodies 2.7-3 heads tall (Body.tsx). One SVG rig
// for everyone: a head (face shape, ears, hair back/front, eyes, brows, nose, mouth, accessories), a short torso with
// a costume layer, legs and shoes, two arms (shoulder -> elbow -> hand) and emotion symbols; each character only swaps
// colours, hair and costume.
// Style: a #2B2620 outline of a fixed on-screen width (Body.tsx InkContext) with round joins (도치's ink), flat fills
// plus one shadow tone (the same colour 12% darker,
// light from the top left), a neutral rim light on dark stages. Age is shown only by hair, glasses and two strokes at
// the eye corners, never by caricature. No red in clothes or props (red means danger on this channel), no logos,
// no uniforms of real institutions.
// Every value comes from the pose (a pure function of the frame, see rig.ts/CastScene.tsx).
import React from "react";
import {BodySpec, bodyOf, FloorShadow, INK, InkContext, inkFor, LEG_LOOKS, Legs, shoulderOf, torsoPath,
  useInk} from "./Body";
import {FONT} from "./fonts";
import {RIG} from "./rig";
import {CharacterId, Expression, Gesture} from "./types";

export {INK};
export const MOUTH_IN = "#5A2C2E";
export const TONGUE = "#D9837A";
export const SWEAT = "#8CC8FF";

export type Fx = "sweat" | "sweat2" | "shockLines" | "blush" | "tears" | "question" | "sparkle" | "gloom" | "puff"
  | "vein";

export type CharPose = {
  id: CharacterId;
  x: number; // neck base, in the svg's coordinates
  y: number;
  k: number; // scale (local unit -> svg px)
  px?: number; // screen px per local unit when the svg itself is scaled (an inset); default k
  view?: "front" | "back";
  turn?: number; // -1..1: the face turned to the viewer's left / right
  tilt?: number; // head tilt, degrees
  lean?: number; // whole body, degrees
  breathe?: number; // -1..1 breathing phase
  expr: Expression;
  mouth?: number; // 0..4 talking viseme (only while talking)
  talking?: boolean;
  look?: [number, number]; // pupils -1..1
  blink?: number; // 0..1
  gesture?: Gesture;
  free?: Gesture; // the free hand while the other holds the phone at the ear (clutchChest | handOnHead)
  mirror?: boolean; // gestures on the other side (pointing to the viewer's left)
  typing?: number; // thumb phase (frames)
  fx?: Fx[];
  squash?: number; // reaction squash: 1 = none
  shake?: number; // px (local)
  nod?: number; // degrees added to the tilt (talking nods, listening nods)
  rim?: string; // rim light colour (dark stages)
  rimWidth?: number; // px on screen
  glow?: {color: string; amount: number; from: "below" | "left" | "right"}; // screen light on the face
  shadowHalf?: number; // fake banker: half the face in shadow, 0..1
  screen?: {bg: string; rows: string[]}; // the phone's screen when we can see it (back view)
  silhouette?: boolean; // the scammer's faceless hood
  monitor?: number; // 0..1 teal monitor light on the scammer's jaw and chest
  tail?: boolean; // animal skin: draw the fox's tail (full figures only)
};

export type Look = {skin: string; hair: string; brow: string; top: string; inner: string; accent: string;
  face: "round" | "square" | "oval"; build: number; age: boolean};

/** Costume palettes: mid-saturation neutrals that never collide with the danger red or the category accents. */
export const LOOKS: Record<CharacterId, Look> = {
  father: {skin: "#EEC6A2", hair: "#B9B6AE", brow: "#8C877E", top: "#B98A5A", inner: "#7C8A5C", accent: "#6B5A3E",
    face: "square", build: 1.06, age: true},
  mother: {skin: "#F3CDB0", hair: "#6B5A4E", brow: "#5A4A40", top: "#8E5B7A", inner: "#EADFC8", accent: "#F6F1E7",
    face: "round", build: 0.95, age: true},
  daughter: {skin: "#F5D4B8", hair: "#3A2A22", brow: "#3A2A22", top: "#3F8F8A", inner: "#D9A93F", accent: "#5B6B7D",
    face: "oval", build: 0.92, age: false},
  son: {skin: "#EFC9A6", hair: "#2E2622", brow: "#2E2622", top: "#5B6B7D", inner: "#F2F0EA", accent: "#3A4452",
    face: "oval", build: 1.0, age: false},
  scammer: {skin: "#1B1D24", hair: "#2A2D36", brow: "#1B1D24", top: "#2A2D36", inner: "#3A3F4B", accent: "#5FD3C8",
    face: "round", build: 1.05, age: false},
  fake_banker: {skin: "#E9C29E", hair: "#262220", brow: "#262220", top: "#3A3F4B", inner: "#F4F2EC", accent: "#2F5E63",
    face: "oval", build: 1.04, age: false},
  ad: {skin: "#F0C9A4", hair: "#4B3628", brow: "#3B2A20", top: "#34405A", inner: "#F4F2EC", accent: "#C99A2E",
    face: "oval", build: 1.0, age: false},
};

/** The same colour `f` darker (the single shadow tone: f = 0.12). */
export const shade = (hex: string, f = 0.12) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.min(255, Math.round(v * (1 - f))).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

const H = RIG.head;
export const P = (pts: [number, number][]) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L") + " Z";

/** Face outline: a superellipse, squarer at the jaw for the father, narrower at the chin for the oval faces. */
const facePath = (shape: Look["face"]) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const lower = s > 0;
    const n = shape === "square" ? (lower ? 2.9 : 2.3) : shape === "oval" ? (lower ? 2.05 : 2.25) : 2.15;
    let x = H.rx * Math.sign(c) * Math.abs(c) ** (2 / n);
    const ry = lower ? H.chin - H.cy : H.ry;
    const y = H.cy + ry * Math.sign(s) * Math.abs(s) ** (2 / n);
    if (shape === "oval" && lower) x *= 1 - 0.1 * s * s;
    pts.push([x, y]);
  }
  return P(pts);
};
const FACES = {round: facePath("round"), square: facePath("square"), oval: facePath("oval")};

export const SLEEVE = 70;

export type Pt = [number, number];
export type ArmSpec = {el: Pt; ha: Pt; shape: string};

/** Arms of a gesture (L = viewer's left, R = viewer's right); a side the gesture leaves free hangs at rest, the paw at
 * the hip (rig.hands.rest). */
export const armsOf = (g: Gesture, mirror: boolean, free: Gesture | undefined, typing: number): {L?: ArmSpec; R?: ArmSpec} => {
  const hands = RIG.hands as unknown as Record<string, {L?: Pt; R?: Pt}>;
  const elbows = RIG.elbows as unknown as Record<string, {L?: Pt; R?: Pt}>;
  const shapeOf = (gg: Gesture, side: "L" | "R") => {
    switch (gg) {
      case "phoneEar": return "phoneEar";
      case "phoneRead": case "phoneType": return "hold";
      case "handOnHead": return "onHead";
      case "handsOnCheeks": return "cheek";
      case "point": return "point";
      case "palmOut": return side === "R" ? "palm" : "holdOne";
      case "clutchChest": return "fist";
      default: return "mitten";
    }
  };
  const out: {L?: ArmSpec; R?: ArmSpec} = {};
  for (const side of ["L", "R"] as const) {
    const h = hands[g]?.[side];
    const e = elbows[g]?.[side];
    if (!h || !e) continue;
    const wob = g === "phoneType" ? Math.sin(typing * 0.9 + (side === "L" ? 0 : 1.7)) * 4 : 0;
    out[side] = {el: [e[0], e[1]], ha: [h[0], h[1] + wob], shape: shapeOf(g, side)};
  }
  // the free hand while the other one holds the phone at the ear
  if (g === "phoneEar" && free && free !== "phoneEar") {
    const h = hands[free]?.R;
    const e = elbows[free]?.R;
    if (h && e) out.L = {el: [-e[0], e[1]], ha: [-h[0], h[1]], shape: free === "handOnHead" ? "onHead" : "fist"};
  }
  for (const side of ["L", "R"] as const) {
    const h = hands.rest[side];
    const e = elbows.rest[side];
    if (!out[side] && h && e) out[side] = {el: [e[0], e[1]], ha: [h[0], h[1]], shape: "rest"};
  }
  if (mirror) {
    const m = (a?: ArmSpec): ArmSpec | undefined => (a ? {el: [-a.el[0], a.el[1]], ha: [-a.ha[0], a.ha[1]],
      shape: a.shape} : undefined);
    return {L: m(out.R), R: m(out.L)};
  }
  return out;
};

const Hand: React.FC<{at: Pt; from: Pt; shape: string; skin: string; side: number}> = ({at, from, shape, skin, side}) => {
  const {lw, ks} = useInk();
  const [x, y] = at;
  const ang = (Math.atan2(y - from[1], x - from[0]) * 180) / Math.PI;
  const R = RIG.handR;
  const sk = {fill: skin, stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const};
  switch (shape) {
    case "point":
      return (
        <g transform={`translate(${x} ${y}) rotate(${ang})`}>
          <rect x={R * 0.4} y={-13} width={R * 1.55} height={27} rx={13} {...sk} />
          <circle r={R * 0.9} {...sk} />
          <path d={`M ${R * 0.2} ${-R * 0.55} q ${R * 0.35} ${R * 0.2} 0 ${R * 0.5}`} stroke={INK} strokeWidth={3.5 * ks}
            fill="none" strokeLinecap="round" />
        </g>
      );
    case "palm":
      return (
        <g transform={`translate(${x} ${y}) scale(1.3)`}>
          {[-27, -9, 9, 27].map((fx, i) => (
            <rect key={i} x={fx - 10} y={-R * 1.55 + Math.abs(fx) * 0.35} width={20} height={R * 1.1} rx={10} {...sk} />
          ))}
          <rect x={-R * 1.15} y={-R * 0.55} width={20} height={R * 0.95} rx={10} {...sk}
            transform={`rotate(-38 ${-R * 1.05} 0)`} />
          <ellipse rx={R * 0.95} ry={R * 0.88} {...sk} />
          <path d={`M -14 -6 q 14 10 28 0`} stroke={shade(skin, 0.25)} strokeWidth={3.5 * ks} fill="none"
            strokeLinecap="round" />
        </g>
      );
    case "fist":
      return (
        <g transform={`translate(${x} ${y}) rotate(${side * 10})`}>
          <ellipse rx={R * 0.95} ry={R * 0.85} {...sk} />
          <path d={`M ${-R * 0.5} ${-R * 0.25} h ${R} M ${-R * 0.45} ${R * 0.15} h ${R * 0.9}`} stroke={INK}
            strokeWidth={3.5 * ks} strokeLinecap="round" />
        </g>
      );
    case "cheek":
      return (
        <g transform={`translate(${x} ${y}) rotate(${-side * 8})`}>
          <ellipse rx={R * 0.82} ry={R * 1.08} {...sk} />
          <path d={`M ${-side * R * 0.15} ${-R * 0.75} v ${R * 0.7} M ${side * R * 0.25} ${-R * 0.7} v ${R * 0.6}`}
            stroke={shade(skin, 0.25)} strokeWidth={3.5 * ks} strokeLinecap="round" />
        </g>
      );
    case "onHead":
      return (
        <g transform={`translate(${x} ${y}) rotate(${side * -30})`}>
          <ellipse rx={R * 1.05} ry={R * 0.78} {...sk} />
          <path d={`M ${-R * 0.5} ${R * 0.05} h ${R * 0.9} M ${-R * 0.4} ${R * 0.38} h ${R * 0.7}`}
            stroke={shade(skin, 0.25)} strokeWidth={3.5 * ks} strokeLinecap="round" />
        </g>
      );
    case "rest":
      // hanging at the hip, the thumb to the front
      return (
        <g transform={`translate(${x} ${y})`}>
          <ellipse cx={-side * R * 0.55} cy={-R * 0.1} rx={R * 0.34} ry={R * 0.3} {...sk} />
          <ellipse rx={R * 0.8} ry={R * 0.92} {...sk} />
        </g>
      );
    default:
      return (
        <g transform={`translate(${x} ${y})`}>
          <ellipse cx={-side * R * 0.62} cy={-R * 0.25} rx={R * 0.38} ry={R * 0.3} {...sk} />
          <ellipse rx={R * 0.9} ry={R} {...sk} />
        </g>
      );
  }
};

const Arm: React.FC<{spec: ArmSpec; side: number; B: BodySpec; color: string; skin: string}> = ({spec, side, B, color,
  skin}) => {
  const {lw} = useInk();
  const sh: Pt = shoulderOf(B, side);
  const d = `M ${sh[0]} ${sh[1]} L ${spec.el[0]} ${spec.el[1]} L ${spec.ha[0]} ${spec.ha[1]}`;
  // the cuff: the last part of the forearm, a shade lighter, ending a little before the hand
  const cx = spec.ha[0] + (spec.el[0] - spec.ha[0]) * 0.34;
  const cy = spec.ha[1] + (spec.el[1] - spec.ha[1]) * 0.34;
  const hand = spec.shape === "phoneEar" || spec.shape === "hold" || spec.shape === "holdOne" ? "mitten" : spec.shape;
  return (
    <g>
      <path d={d} stroke={INK} strokeWidth={SLEEVE + lw * 2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke={color} strokeWidth={SLEEVE} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M ${spec.el[0]} ${spec.el[1]} L ${cx} ${cy}`} stroke={shade(color)} strokeWidth={SLEEVE * 0.42}
        fill="none" strokeLinecap="round" opacity={0.7} transform={`translate(${side * 12} 6)`} />
      {spec.shape === "phoneEar" ? (
        <g transform={`translate(${spec.ha[0] - side * 22} ${spec.ha[1] - 46}) rotate(${side * -14})`}>
          <rect x={-31} y={-66} width={62} height={128} rx={14} fill="#2D323C" stroke={INK} strokeWidth={lw} />
          <rect x={-22} y={-56} width={8} height={30} rx={4} fill="#59606E" />
        </g>
      ) : null}
      {spec.shape === "holdOne" ? (
        <g transform={`translate(${spec.ha[0] + 6} ${spec.ha[1] - 58}) rotate(-8)`}>
          <rect x={-46} y={-80} width={92} height={150} rx={16} fill="#2D323C" stroke={INK} strokeWidth={lw} />
        </g>
      ) : null}
      <Hand at={spec.ha} from={spec.el} shape={hand} skin={skin} side={side} />
    </g>
  );
};

/* ------------------------------------------------------------------ face parts */

export const browSet = (e: Expression): [[number, number], [number, number]] => {
  // [inner y, outer y] for the viewer's left brow and right brow
  switch (e) {
    case "worried": return [[-270, -244], [-270, -244]];
    case "shocked": return [[-290, -280], [-290, -280]];
    case "panicked": return [[-274, -242], [-274, -242]];
    case "relieved": return [[-248, -252], [-248, -252]];
    case "suspicious": return [[-238, -244], [-270, -262]];
    case "smug": return [[-242, -260], [-246, -262]];
    case "fakeKind": return [[-274, -266], [-274, -266]];
    case "excited": return [[-276, -266], [-276, -266]];
    default: return [[-252, -256], [-252, -256]];
  }
};

export const Eye: React.FC<{cx: number; cy: number; e: Expression; blink: number; look: [number, number]; far: number;
  side: number}> = ({cx, cy, e, blink, look, far, side}) => {
  const {ks} = useInk();
  const sx = 1 - 0.16 * far;
  const lx = look[0] * 7;
  const ly = look[1] * 6;
  const stroke = {stroke: INK, strokeWidth: 7 * ks, fill: "none", strokeLinecap: "round" as const};
  const closed = <path d={`M ${-17} 2 Q 0 11 17 2`} {...stroke} />;
  const g = (child: React.ReactNode) => <g transform={`translate(${cx} ${cy}) scale(${sx} 1)`}>{child}</g>;
  if (e === "relieved" || e === "fakeKind") return g(<path d={`M -18 6 Q 0 -15 18 6`} {...stroke} />);
  if (e === "shocked" || e === "panicked") {
    return g(
      <>
        <ellipse rx={26} ry={30} fill="#FFFFFF" stroke={INK} strokeWidth={5 * ks} />
        {e === "shocked" ? <circle cx={lx * 0.8} cy={ly * 0.8} r={6.5} fill={INK} /> : (
          <>
            <ellipse cx={lx * 0.6} cy={3 + ly * 0.6} rx={13} ry={16} fill={INK} />
            <circle cx={lx * 0.6 - 5} cy={-3 + ly * 0.6} r={5} fill="#fff" />
            <circle cx={lx * 0.6 + 5} cy={9 + ly * 0.6} r={2.6} fill="#fff" />
            <path d="M -20 18 Q 0 30 20 18" stroke={SWEAT} strokeWidth={5 * ks} fill="none" strokeLinecap="round" />
          </>
        )}
      </>,
    );
  }
  if (blink > 0.5 && e !== "suspicious" && e !== "smug") return g(closed);
  const open = 1 - (e === "suspicious" || e === "smug" ? 0 : blink * 0.85);
  if (e === "suspicious" || e === "smug") {
    const lid = e === "suspicious" ? -side * 3 : 0;
    return g(
      <>
        <path d={`M -16 -2 A 16 ${19 * (1 - blink * 0.6)} 0 0 0 16 -2 Z`} fill={INK}
          transform={`translate(${lx * 0.9 + (e === "suspicious" ? 5 * side : 0)} ${2})`} />
        <path d={`M -21 ${-3 + lid} L 21 ${-3 - lid}`} {...stroke} strokeWidth={7 * ks} />
      </>,
    );
  }
  const big = e === "excited";
  return g(
    <>
      <ellipse cx={lx} cy={ly} rx={big ? 18 : 15} ry={(big ? 24 : 21) * open} fill={INK} />
      {open > 0.5 ? (
        <>
          <circle cx={lx - 5} cy={ly - 8} r={big ? 7 : 5.5} fill="#fff" />
          <circle cx={lx + 5} cy={ly + 7} r={big ? 3.6 : 2.6} fill="#fff" />
        </>
      ) : null}
    </>,
  );
};

/** The mouth: the talking viseme (0..4) shaped by the expression, or the expression's resting mouth. */
export const Mouth: React.FC<{e: Expression; talking: boolean; v: number; mx: number; my: number; light?: boolean}> = ({e,
  talking, v, mx, my, light}) => {
  const {lw, ks} = useInk();
  const ink = light ? "#0E0F13" : INK;
  const inside = light ? "#E8E0D4" : MOUTH_IN;
  const st = {stroke: ink, strokeWidth: lw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const};
  const happy = e === "fakeKind" || e === "excited" || e === "smug" || e === "relieved";
  const sad = e === "worried" || e === "panicked";
  const open = (w: number, h: number, tongue: boolean, teeth: boolean) => happy ? (
    <g transform={`translate(${mx} ${my})`}>
      <path d={`M ${-w} ${-h * 0.35} Q 0 ${-h * 0.55} ${w} ${-h * 0.35} Q ${w * 0.9} ${h} 0 ${h} Q ${-w * 0.9} ${h}
        ${-w} ${-h * 0.35} Z`} fill={inside} {...st} />
      {teeth && !light ? <path d={`M ${-w * 0.78} ${-h * 0.3} Q 0 ${-h * 0.45} ${w * 0.78} ${-h * 0.3} L ${w * 0.7}
        ${-h * 0.02} Q 0 ${h * 0.06} ${-w * 0.7} ${-h * 0.02} Z`} fill="#fff" /> : null}
      {tongue && !light ? <ellipse cx={0} cy={h * 0.62} rx={w * 0.5} ry={h * 0.28} fill={TONGUE} /> : null}
    </g>
  ) : (
    <g transform={`translate(${mx} ${my + (sad ? 3 : 0)})`}>
      <ellipse rx={w} ry={h} fill={inside} {...st} />
      {teeth && !light ? <path d={`M ${-w * 0.7} ${-h * 0.62} Q 0 ${-h * 0.95} ${w * 0.7} ${-h * 0.62}`} stroke="#fff"
        strokeWidth={Math.min(9, h * 0.45)} fill="none" strokeLinecap="round" /> : null}
      {tongue && !light ? <ellipse cx={0} cy={h * 0.5} rx={w * 0.55} ry={h * 0.32} fill={TONGUE} /> : null}
    </g>
  );
  if (talking && v > 0) {
    switch (v) {
      case 1: return open(25, 8, false, false);
      case 2: return open(23, 15, false, true);
      case 3: return open(26, 25, true, true);
      default: return open(14, 16, false, false);
    }
  }
  const line = (d: string) => <path d={d} fill="none" {...st} transform={`translate(${mx} ${my})`} />;
  if (talking) return line(happy ? "M -22 -4 Q 0 10 22 -4" : sad ? "M -20 4 Q 0 -6 20 4" : "M -18 0 Q 0 4 18 0");
  switch (e) {
    case "worried": return line("M -26 4 q 9 -9 17 0 t 17 0 t 17 0");
    case "shocked": return open(16, 24, false, false);
    case "panicked": return (
      <g transform={`translate(${mx} ${my})`}>
        <path d="M -30 -6 Q 0 -14 30 -6 L 24 20 Q 12 14 0 20 Q -12 14 -24 20 Z" fill={light ? inside : MOUTH_IN} {...st} />
        {light ? null : <path d="M -22 -6 Q 0 -11 22 -6" stroke="#fff" strokeWidth={6 * ks} fill="none" />}
      </g>
    );
    case "relieved": return line("M -30 -4 Q 0 18 30 -4");
    case "suspicious": return line("M 2 2 Q 16 -4 30 -6 M 2 2 l -4 3");
    case "smug": return light ? (
      <g transform={`translate(${mx} ${my})`}>
        <path d="M -40 -8 Q 0 34 46 -22 Q 8 12 -40 -8 Z" fill={inside} stroke={ink} strokeWidth={4 * ks} strokeLinejoin="round" />
      </g>
    ) : line("M -24 2 Q 6 10 28 -12");
    case "fakeKind": return open(40, 26, false, true);
    case "excited": return open(30, 24, true, true);
    default: return line("M -20 -2 Q 0 10 20 -2");
  }
};

/* ------------------------------------------------------------------ hair and heads */

/** Union of circles with one outline: all outlines first, then all fills (the perm, the hood's curls). */
export const Cloud: React.FC<{circles: [number, number, number][]; fill: string; extra?: React.ReactNode}> = ({circles, fill,
  extra}) => {
  const {lw} = useInk();
  return (
  <g>
    {circles.map(([x, y, r], i) => <circle key={`o${i}`} cx={x} cy={y} r={r} fill={INK} stroke={INK}
      strokeWidth={lw * 2} />)}
    {circles.map(([x, y, r], i) => <circle key={`f${i}`} cx={x} cy={y} r={r} fill={fill} />)}
    {extra}
  </g>
  );
};

const permBack = (): [number, number, number][] => {
  const out: [number, number, number][] = [[0, -235, 150], [-70, -210, 140], [70, -210, 140]];
  for (let i = 0; i <= 11; i++) {
    const a = ((158 + (i * 224) / 11) * Math.PI) / 180;
    out.push([Math.cos(a) * 168, -222 + Math.sin(a) * 178, 50 + ((i * 37) % 9)]);
  }
  return out;
};
const PERM_BACK = permBack();
const PERM_FRONT: [number, number, number][] = [[-118, -322, 36], [-74, -346, 36], [-26, -356, 37], [24, -356, 37],
  [72, -346, 36], [116, -324, 35]];

const HOOD_RIM = "M -176 -250 C -190 -120 -124 -20 0 -12 C 124 -20 190 -120 176 -250";

const HairBack: React.FC<{id: CharacterId; L: Look; back: boolean}> = ({id, L, back}) => {
  const {lw, ks} = useInk();
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const};
  switch (id) {
    case "mother":
      return <Cloud circles={back ? [...PERM_BACK, [0, -150, 120] as [number, number, number]] : PERM_BACK} fill={L.hair} />;
    case "daughter":
      return (
        <path d={`M -192 -240 C -206 -390 -100 -440 0 -440 C 100 -440 206 -390 192 -240 L 200 ${back ? -40 : -86}
          C 168 ${back ? -10 : -56} 132 ${back ? -16 : -64} 118 ${back ? -40 : -86} L -118 ${back ? -40 : -86}
          C -132 ${back ? -16 : -64} -168 ${back ? -10 : -56} -200 ${back ? -40 : -86} Z`} fill={L.hair} {...st} />
      );
    case "father":
      return back ? (
        <g>
          {/* the grey horseshoe round the back of a bald head: high at the ears, low at the nape */}
          <path d="M -172 -276 C -110 -196 110 -196 172 -276 C 184 -190 168 -96 120 -58 Q 104 -40 84 -52 Q 60 -34 34 -46
            Q 8 -30 -18 -46 Q -44 -32 -66 -50 Q -96 -38 -114 -58 C -166 -96 -184 -190 -172 -276 Z" fill={L.hair} {...st} />
          <g stroke={shade(L.hair, 0.18)} strokeWidth={4 * ks} fill="none" strokeLinecap="round">
            <path d="M -120 -190 q 10 50 4 92" /><path d="M -60 -170 q 8 50 2 96" /><path d="M 0 -164 q 6 50 0 100" />
            <path d="M 60 -170 q 6 50 -2 96" /><path d="M 120 -190 q 6 50 -6 92" />
          </g>
        </g>
      ) : null;
    case "scammer":
      // the hood, around and behind the head down to the shoulders
      return (
        <path d="M -214 -210 C -222 -360 -120 -448 0 -448 C 120 -448 222 -360 214 -210 C 210 -120 236 -40 262 20
          L -262 20 C -236 -40 -210 -120 -214 -210 Z" fill={L.hair} {...st} />
      );
    default:
      return null;
  }
};

const HairFront: React.FC<{id: CharacterId; L: Look; dx: number; back: boolean}> = ({id, L, dx, back}) => {
  const {lw, ks} = useInk();
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const};
  const hl = shade(L.hair, -0.25);
  if (back) {
    switch (id) {
      case "son": case "fake_banker": case "ad":
        return <path d="M -168 -230 C -176 -390 -80 -432 0 -432 C 80 -432 176 -390 168 -230 C 120 -200 -120 -200 -168 -230 Z"
          fill={L.hair} {...st} />;
      case "father":
        return <ellipse cx={-50} cy={-330} rx={46} ry={20} fill="#fff" opacity={0.22} />;
      default:
        return null;
    }
  }
  switch (id) {
    case "father":
      return (
        <g>
          {[-1, 1].map((s) => (
            <path key={s} d={`M ${s * 128} -300 C ${s * 172} -290 ${s * 186} -230 ${s * 178} -168 C ${s * 172} -150
              ${s * 160} -146 ${s * 150} -150 C ${s * 158} -186 ${s * 150} -236 ${s * 118} -268 Z`} fill={L.hair} {...st} />
          ))}
          <path d={`M ${-46 + dx * 0.4} -372 C ${-10 + dx * 0.4} -386 ${30 + dx * 0.4} -384 ${62 + dx * 0.4} -366`}
            stroke={shade(L.hair, 0.15)} strokeWidth={4 * ks} fill="none" strokeLinecap="round" />
          <path d={`M ${-30 + dx * 0.4} -360 C ${0 + dx * 0.4} -372 ${26 + dx * 0.4} -370 ${46 + dx * 0.4} -358`}
            stroke={shade(L.hair, 0.15)} strokeWidth={4 * ks} fill="none" strokeLinecap="round" />
          <ellipse cx={-60 + dx * 0.3} cy={-330} rx={40} ry={16} fill="#fff" opacity={0.25} transform="rotate(-18 -60 -330)" />
        </g>
      );
    case "mother":
      return (
        <Cloud circles={PERM_FRONT.map(([x, y, r]) => [x + dx * 0.5, y, r] as [number, number, number])} fill={L.hair}
          extra={(
            <g stroke="#E6DED3" strokeWidth={4 * ks} fill="none" strokeLinecap="round" opacity={0.9}>
              <path d={`M ${-96 + dx * 0.5} -350 q 14 -12 26 0`} />
              <path d={`M ${40 + dx * 0.5} -372 q 14 -12 26 0`} />
              <path d={`M ${-150} -270 q 10 -14 24 -4`} />
              <path d={`M ${130} -392 q 12 -10 22 2`} />
            </g>
          )} />
      );
    case "daughter":
      return (
        <g>
          <path d={`M ${-170 + dx * 0.2} -236 C ${-182 + dx * 0.5} -372 ${-70 + dx * 0.5} -420 ${30 + dx * 0.5} -414
            C ${126 + dx * 0.5} -408 ${180 + dx * 0.4} -350 ${176 + dx * 0.2} -250 C ${150 + dx * 0.4} -300
            ${100 + dx * 0.5} -330 ${50 + dx * 0.5} -334 C ${20 + dx * 0.5} -300 ${-70 + dx * 0.5} -262
            ${-170 + dx * 0.2} -236 Z`} fill={L.hair} {...st} />
          <path d={`M ${-110 + dx * 0.5} -360 C ${-60 + dx * 0.5} -394 ${10 + dx * 0.5} -398 ${50 + dx * 0.5} -386`}
            stroke={hl} strokeWidth={7 * ks} fill="none" strokeLinecap="round" />
        </g>
      );
    case "son":
      return (
        <path d={`M ${-166 + dx * 0.2} -244 C ${-176 + dx * 0.4} -380 ${-80 + dx * 0.5} -426 ${10 + dx * 0.5} -422
          C ${110 + dx * 0.5} -418 ${176 + dx * 0.4} -364 ${166 + dx * 0.2} -248 C ${150 + dx * 0.4} -296
          ${120 + dx * 0.5} -318 ${90 + dx * 0.5} -326 L ${70 + dx * 0.5} -300 L ${46 + dx * 0.5} -332
          C ${-10 + dx * 0.5} -334 ${-90 + dx * 0.5} -318 ${-134 + dx * 0.3} -290 Z`} fill={L.hair} {...st} />
      );
    case "fake_banker":
      return (
        <g>
          <path d={`M ${-166 + dx * 0.2} -236 C ${-178 + dx * 0.4} -384 ${-80 + dx * 0.5} -430 ${10 + dx * 0.5} -426
            C ${110 + dx * 0.5} -422 ${178 + dx * 0.4} -368 ${166 + dx * 0.2} -244 C ${150 + dx * 0.4} -300
            ${110 + dx * 0.5} -334 ${-40 + dx * 0.5} -330 C ${-90 + dx * 0.5} -320 ${-130 + dx * 0.4} -290
            ${-166 + dx * 0.2} -236 Z`} fill={L.hair} {...st} />
          <path d={`M ${-56 + dx * 0.5} -330 C ${-30 + dx * 0.5} -380 ${20 + dx * 0.5} -402 ${70 + dx * 0.5} -400`}
            stroke={hl} strokeWidth={6 * ks} fill="none" strokeLinecap="round" />
        </g>
      );
    case "ad":
      return (
        <g>
          <path d={`M ${-168 + dx * 0.2} -240 C ${-190 + dx * 0.4} -400 ${-60 + dx * 0.5} -462 ${40 + dx * 0.5} -446
            C ${140 + dx * 0.5} -430 ${190 + dx * 0.4} -370 ${168 + dx * 0.2} -246 C ${150 + dx * 0.4} -310
            ${120 + dx * 0.5} -344 ${60 + dx * 0.5} -350 C ${0 + dx * 0.5} -330 ${-110 + dx * 0.4} -300
            ${-168 + dx * 0.2} -240 Z`} fill={L.hair} {...st} />
          <path d={`M ${-80 + dx * 0.5} -380 C ${-30 + dx * 0.5} -426 ${40 + dx * 0.5} -432 ${90 + dx * 0.5} -414`}
            stroke={hl} strokeWidth={8} fill="none" strokeLinecap="round" />
        </g>
      );
    case "scammer":
      return (
        <g>
          {/* the cap: crown and a brim pulled low; the hood's rim around the face opening */}
          <path d="M -150 -300 C -150 -400 -70 -420 0 -420 C 70 -420 150 -400 150 -300 Z" fill={L.inner}
            stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
          <path d="M -176 -296 C -120 -318 120 -318 176 -296 C 186 -270 150 -258 0 -262 C -150 -258 -186 -270 -176 -296 Z"
            fill={shade(L.inner, 0.2)} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
          <path d={HOOD_RIM} fill="none" stroke={INK} strokeWidth={34} strokeLinecap="round" />
          <path d={HOOD_RIM} fill="none" stroke={shade(L.hair, -0.16)} strokeWidth={22} strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
};

/** Costume layer over the short torso (front only): a neckline, two buttons or a pocket, nothing that runs the length
 * of the body (a long front line makes a torso read long). */
export const Costume: React.FC<{id: CharacterId; L: Look; B: BodySpec; back: boolean; uid: string}> = ({id, L, B, back}) => {
  const {lw, ks} = useInk();
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const};
  const thin = {stroke: INK, strokeWidth: 3.5 * ks, strokeLinecap: "round" as const, fill: "none"};
  const hw = Math.max(B.w, B.hip) + 4;
  const rib = <path d={`M ${-hw} ${B.hemY - 24} Q 0 ${B.hemY - 10} ${hw} ${B.hemY - 24}`} {...thin} opacity={0.55} />;
  const pocket = (
    <path d={`M -112 ${B.hemY - 96} L 112 ${B.hemY - 96} L 134 ${B.hemY - 14} L -134 ${B.hemY - 14} Z`}
      {...thin} fill="rgba(0,0,0,0.08)" opacity={0.8} />
  );
  if (back) return id === "son" || id === "scammer" ? rib : null;
  switch (id) {
    case "father":
      return (
        <g>
          <path d="M -50 -14 L 50 -14 L 0 116 Z" fill={L.inner} {...st} />
          <path d="M -48 -16 L -8 32 L -62 46 Z M 48 -16 L 8 32 L 62 46 Z" fill={shade(L.inner, -0.12)} {...st} />
          {[150, 198].map((y) => <circle key={y} cx={0} cy={y} r={9} fill={L.accent} stroke={INK} strokeWidth={3.5 * ks} />)}
          <path d={`M -128 196 h 58 M 70 196 h 58`} {...thin} opacity={0.6} />
          {rib}
        </g>
      );
    case "mother":
      return (
        <g>
          <path d="M -58 -10 C -62 56 -30 90 0 90 C 30 90 62 56 58 -10 Z" fill={L.inner} {...st} />
          <path d="M -46 -14 C -64 30 -30 48 0 38 C 30 48 64 30 46 -14" fill={shade(L.top, -0.18)} {...st} />
          {[128, 172].map((y) => <circle key={y} cx={0} cy={y} r={7} fill={L.accent} stroke={INK} strokeWidth={3 * ks} />)}
          {rib}
        </g>
      );
    case "daughter":
      return (
        <g>
          <path d="M -58 -12 C -40 18 40 18 58 -12 L 0 136 Z" fill={L.inner} {...st} />
          {/* ID lanyard with a blank card */}
          <path d="M -34 0 L 6 138 M 34 0 L 20 138" stroke={L.accent} strokeWidth={8} strokeLinecap="round" />
          <g transform="translate(14 178) rotate(4) scale(0.78)">
            <rect x={-40} y={-54} width={80} height={104} rx={10} fill="#F6F3EC" stroke={INK} strokeWidth={4.5 * ks} />
            <rect x={-40} y={-54} width={80} height={22} rx={8} fill={L.accent} />
            <rect x={-24} y={-20} width={48} height={36} rx={6} fill="#D9D3C7" />
          </g>
        </g>
      );
    case "son":
      return (
        <g>
          <path d="M -46 -14 C -40 30 40 30 46 -14 Z" fill={L.inner} {...st} />
          <path d="M -150 -6 C -120 40 120 40 150 -6" fill="none" stroke={shade(L.top, 0.2)} strokeWidth={18}
            strokeLinecap="round" />
          <path d="M -28 30 L -32 118 M 28 30 L 32 118" stroke="#E7E3DA" strokeWidth={7} strokeLinecap="round" />
          {pocket}
          {rib}
        </g>
      );
    case "scammer":
      return (
        <g>
          <path d="M -30 20 L -36 132 M 30 20 L 36 132" stroke="#555B68" strokeWidth={7} strokeLinecap="round" />
          {pocket}
          {rib}
        </g>
      );
    case "fake_banker":
    case "ad":
      return (
        <g>
          <path d="M -52 -14 L 52 -14 L 0 196 Z" fill={L.inner} {...st} />
          <path d="M -13 24 L 13 24 L 19 158 L 0 184 L -19 158 Z" fill={L.accent} {...st} />
          <path d="M -16 4 L 16 4 L 12 26 L -12 26 Z" fill={shade(L.accent, 0.15)} {...st} />
          {/* lapels */}
          <path d="M -54 -14 L -94 118 L -46 100 L 0 198" fill="none" {...st} />
          <path d="M 54 -14 L 94 118 L 46 100 L 0 198" fill="none" {...st} />
          <circle cx={0} cy={228} r={8} fill={shade(L.top, 0.25)} stroke={INK} strokeWidth={3 * ks} />
          {id === "fake_banker" ? (
            <g transform="translate(-118 182) rotate(-5) scale(0.82)">
              {/* a generic, blank staff card (no institution) */}
              <path d="M 70 -200 L 0 -50" stroke="#8D93A0" strokeWidth={6} strokeLinecap="round" />
              <rect x={-44} y={-56} width={88} height={112} rx={10} fill="#ECEAE4" stroke={INK} strokeWidth={4.5 * ks} />
              <rect x={-30} y={-38} width={40} height={46} rx={6} fill="#C9C4B8" />
              <path d="M 18 -30 h 14 M 18 -14 h 14 M -30 26 h 60" stroke="#ABA597" strokeWidth={5} strokeLinecap="round" />
            </g>
          ) : (
            <path d="M 96 112 l 40 -6 l 6 22 l -40 6 Z" fill="#F4F2EC" stroke={INK} strokeWidth={3.5 * ks} />
          )}
        </g>
      );
    default:
      return null;
  }
};

/* ------------------------------------------------------------------ emotion symbols */

export const FxLayer: React.FC<{fx: Fx[]; dx: number; light: boolean; frame: number}> = ({fx, dx, light, frame}) => {
  const {ks} = useInk();
  const on = (f: Fx) => fx.includes(f);
  const drop = (x: number, y: number, s = 1) => (
    <path transform={`translate(${x} ${y}) scale(${s})`} d="M 0 -30 C 8 -14 22 4 22 16 A 22 22 0 0 1 -22 16 C -22 4 -8 -14 0 -30 Z"
      fill={SWEAT} stroke={INK} strokeWidth={4.5 * ks} />
  );
  const fall = (frame % 36) / 36;
  return (
    <g>
      {on("gloom") ? (
        <g stroke="#6F7FD8" strokeWidth={6 * ks} strokeLinecap="round" opacity={0.75}>
          {[-90, -54, -18, 18, 54, 90].map((x, i) => <path key={i} d={`M ${x + dx * 0.5} ${-350 + (i % 2) * 10} v ${48 + (i % 3) * 12}`} />)}
        </g>
      ) : null}
      {on("blush") ? (
        <g>
          {[-1, 1].map((s) => (
            <g key={s}>
              <ellipse cx={s * 96 + dx} cy={-136} rx={32} ry={17} fill="#F29A9A" opacity={0.6} />
              <path d={`M ${s * 96 + dx - 16} -142 l -7 12 M ${s * 96 + dx} -142 l -7 12 M ${s * 96 + dx + 16} -142 l -7 12`}
                stroke="#D9737A" strokeWidth={3.5 * ks} strokeLinecap="round" />
            </g>
          ))}
        </g>
      ) : null}
      {on("tears") ? (
        <g>
          {[-1, 1].map((s) => (
            <path key={s} d={`M ${s * 62 + dx} -160 C ${s * 66 + dx} -120 ${s * 70 + dx} -96 ${s * 74 + dx} -70`}
              stroke={SWEAT} strokeWidth={13} fill="none" strokeLinecap="round" opacity={0.95} />
          ))}
          {drop(74 + dx, -40 + fall * 40, 0.5)}
        </g>
      ) : null}
      {on("sweat") ? drop(150, -320 + Math.sin(frame / 7) * 4) : null}
      {on("sweat2") ? drop(-158, -296 + Math.cos(frame / 6) * 4, 0.8) : null}
      {on("shockLines") ? (
        <g stroke={light ? "#F3EEE6" : INK} strokeWidth={7 * ks} strokeLinecap="round">
          {[-150, -128, -106, -74, -52, -30].map((a, i) => {
            const r = (a * Math.PI) / 180;
            const r0 = 236 + (i % 2) * 10;
            return <path key={i} d={`M ${Math.cos(r) * r0} ${-205 + Math.sin(r) * r0} L ${Math.cos(r) * (r0 + 46)}
              ${-205 + Math.sin(r) * (r0 + 46)}`} />;
          })}
        </g>
      ) : null}
      {on("question") ? (
        <text x={-262} y={-318} fontFamily={FONT} fontWeight={900} fontSize={104} fill={light ? "#F3EEE6" : INK}
          stroke={light ? INK : "#FFFDF8"} strokeWidth={6 * ks} paintOrder="stroke" transform={`rotate(-12 -262 -318)`}>?</text>
      ) : null}
      {on("sparkle") ? (
        <g fill="#FFE9A8" stroke={INK} strokeWidth={4 * ks} strokeLinejoin="round">
          {[[-200, -300, 1], [206, -250, 0.7], [-178, -150, 0.55]].map(([x, y, s], i) => {
            const p = 0.75 + 0.25 * Math.sin(frame / 5 + i * 2);
            return <path key={i} transform={`translate(${x} ${y}) scale(${s * p})`}
              d="M 0 -30 Q 5 -5 30 0 Q 5 5 0 30 Q -5 5 -30 0 Q -5 -5 0 -30 Z" />;
          })}
        </g>
      ) : null}
      {on("vein") ? (
        <g transform="translate(118 -318)" stroke="#B24A5A" strokeWidth={7 * ks} fill="none" strokeLinecap="round">
          <path d="M -24 -8 q 8 -4 14 -14 M 8 -22 q 4 8 14 14 M 24 8 q -8 4 -14 14 M -8 22 q -4 -8 -14 -14" />
        </g>
      ) : null}
      {on("puff") ? (
        <g fill="#FFFFFF" stroke={INK} strokeWidth={3.5 * ks} opacity={0.85}>
          <circle cx={92 + dx} cy={-84} r={14} />
          <circle cx={122 + dx} cy={-96} r={10} />
          <circle cx={142 + dx} cy={-112} r={6} />
        </g>
      ) : null}
    </g>
  );
};

/* ------------------------------------------------------------------ the character */

export const Phone2: React.FC<{screen?: CharPose["screen"]; glow: boolean}> = ({screen, glow}) => {
  const {lw, ks} = useInk();
  return (
  <g>
    <rect x={-60} y={-100} width={120} height={200} rx={20} fill="#2D323C" stroke={INK} strokeWidth={lw} />
    {screen ? (
      <g>
        <rect x={-50} y={-88} width={100} height={176} rx={12} fill={screen.bg} />
        <rect x={-50} y={-88} width={100} height={24} rx={10} fill="rgba(255,255,255,0.10)" />
        {screen.rows.map((c, i) => (
          <rect key={i} x={i % 2 ? -4 : -42} y={-54 + i * 34} width={46} height={22} rx={10} fill={c} />
        ))}
      </g>
    ) : (
      <circle cx={-34} cy={-76} r={7} fill="#4B5260" />
    )}
    {glow ? <rect x={-60} y={-100} width={120} height={200} rx={20} fill="none" stroke="#DDF3FF" strokeWidth={4 * ks}
      opacity={0.5} /> : null}
  </g>
  );
};

/** The over-the-shoulder arms: the phone hand up at the right, the left arm hanging. */
export const backArms = (): {L?: ArmSpec; R?: ArmSpec} => ({
  R: {el: RIG.back.elbow as Pt, ha: RIG.back.hand as Pt, shape: "mitten"},
  L: {el: RIG.elbows.rest.L as Pt, ha: RIG.hands.rest.L as Pt, shape: "rest"},
});

/** The reaction squash (and breathing) of the upper body, pivoting on the hem so the legs stay planted. */
export const squashAt = (B: BodySpec, squash: number, breathe: number) =>
  `translate(0 ${B.hemY}) scale(${1 + (1 - squash) * 0.6} ${squash * breathe}) translate(0 ${-B.hemY})`;

/** The shadow tone down the torso's right side. */
export const sideShade = (B: BodySpec) => `M ${B.sh - 30} 40 C ${B.w + 6} 96 ${B.w - 2} 200 ${B.w - 20} ${B.hemY + 30}
  L ${B.w + 80} ${B.hemY + 30} L ${B.w + 80} 0 Z`;

/**
 * One character, drawn in its own <svg> (so the stagings can dim, desaturate or blur it with CSS filters).
 * `box` = the svg's size (the full frame or a framed inset).
 */
export const Character: React.FC<{pose: CharPose; uid: string; box?: {w: number; h: number}; frame: number;
  style?: React.CSSProperties}> = ({pose, uid, box = {w: 1080, h: 1920}, frame, style}) => {
  const p = pose;
  const L = LOOKS[p.id];
  const B = bodyOf(p.id);
  const ink = inkFor(p.px ?? p.k);
  const {lw, ks} = ink;
  const back = p.view === "back";
  const turn = Math.max(-1, Math.min(1, p.turn ?? 0));
  const dx = turn * 28;
  const far = Math.abs(turn);
  const e = p.expr;
  const silhouette = p.id === "scammer";
  const fx = p.fx ?? [];
  const gesture = p.gesture ?? "rest";
  const arms = back ? backArms() : armsOf(gesture, Boolean(p.mirror), p.free, p.typing ?? frame);
  const high = (a?: ArmSpec) => Boolean(a && a.ha[1] < -20);
  const holding = !back && (gesture === "phoneRead" || gesture === "phoneType");
  const breathe = 1 + 0.012 * (p.breathe ?? 0);
  const squash = p.squash ?? 1;
  const tilt = (p.tilt ?? 0) + (p.nod ?? 0);
  const legs = LEG_LOOKS[p.id];
  // rim light on dark stages: the silhouette grown by rimWidth px in the rim colour, as four hard CSS drop shadows
  // (a third of the cost of an SVG feMorphology dilate over a full-frame region)
  const rimPx = p.rim ? p.rimWidth ?? 7 : 0;
  const rimCss = p.rim ? [[rimPx, 0], [-rimPx, 0], [0, rimPx], [0, -rimPx]]
    .map(([a, c]) => `drop-shadow(${a}px ${c}px 0 ${p.rim}E6)`).join(" ") : "";
  const faceD = FACES[L.face];
  const look: [number, number] = p.look ?? [0, 0];
  const lightMouth = silhouette;
  const skinShade = shade(L.skin);
  const faceId = `${uid}-face`;
  const torsoId = `${uid}-torso`;
  const brows = browSet(e);

  const armEl = (side: "L" | "R") => {
    const a = arms[side];
    return a ? <Arm key={side} spec={a} side={side === "L" ? -1 : 1} B={B} color={L.top} skin={silhouette ? "#5A606E" : L.skin} /> : null;
  };

  const head = (
    <g transform={`translate(${p.shake ?? 0} 0) rotate(${tilt} 0 -60)`}>
      {back ? null : <HairBack id={p.id} L={L} back={false} />}
      {/* ears (behind the face; the far one tucks in when the face turns) */}
      {!silhouette ? [-1, 1].map((s) => (
        <g key={s} transform={`translate(${s * 158 - turn * 22} -192)`}>
          <ellipse rx={28} ry={34} fill={L.skin} stroke={INK} strokeWidth={lw} />
          <path d={`M ${s * 8} -14 q ${s * 10} 14 0 26`} stroke={skinShade} strokeWidth={5 * ks} fill="none" strokeLinecap="round" />
          {p.id === "mother" && !back ? <circle cx={s * 2} cy={34} r={9} fill="#FBF7EF" stroke={INK} strokeWidth={3.5 * ks} /> : null}
        </g>
      )) : null}
      {/* the face */}
      <defs>
        <clipPath id={faceId}><path d={faceD} /></clipPath>
      </defs>
      <path d={faceD} fill={L.skin} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
      <g clipPath={`url(#${faceId})`}>
        {!silhouette ? (
          <>
            <path d={faceD} fill={skinShade} />
            <path d={faceD} fill={L.skin} transform="translate(-14 -10)" />
          </>
        ) : null}
        {p.glow && p.glow.amount > 0 ? (
          <g opacity={p.glow.amount}>
            <defs>
              <radialGradient id={`${uid}-glow`} cx={p.glow.from === "below" ? "50%" : p.glow.from === "left" ? "0%" : "100%"}
                cy={p.glow.from === "below" ? "100%" : "40%"} r="75%">
                <stop offset="0%" stopColor={p.glow.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={p.glow.color} stopOpacity={0} />
              </radialGradient>
            </defs>
            <rect x={-200} y={-400} width={400} height={400} fill={`url(#${uid}-glow)`} />
          </g>
        ) : null}
        {fx.includes("gloom") && !back ? (
          <rect x={-200} y={-400} width={400} height={170} fill="#6F7FD8" opacity={0.28} />
        ) : null}
        {silhouette && (p.monitor ?? 0) > 0 ? (
          // the monitor's teal light along the jaw (the screen is to the viewer's right)
          <path d={faceD} fill="none" stroke={L.accent} strokeWidth={34} opacity={0.55 * (p.monitor ?? 0)}
            transform="translate(-16 -6)" />
        ) : null}
      </g>
      {back ? <HairBack id={p.id} L={L} back /> : null}
      {!back ? (
        <g>
          {silhouette ? (
            // faceless: two glints under the brim, and the mouth
            <g>
              {[-1, 1].map((s) => <ellipse key={s} cx={s * 52 + dx} cy={-206} rx={10} ry={5} fill={L.accent}
                opacity={0.75} />)}
            </g>
          ) : (
            <g>
              {[-1, 1].map((s) => (
                <Eye key={s} cx={s * RIG.eyeDX + dx} cy={RIG.eyeY} e={e} blink={p.blink ?? 0} look={look}
                  far={Math.sign(turn) === s ? far : 0} side={s} />
              ))}
              {/* brows */}
              {[-1, 1].map((s, i) => {
                const [inner, outer] = brows[i];
                const xi = s * 30 + dx;
                const xo = s * 94 + dx;
                return <path key={s} d={`M ${xo} ${outer} Q ${(xi + xo) / 2} ${Math.min(inner, outer) - 9} ${xi} ${inner}`}
                  stroke={L.brow} strokeWidth={p.id === "father" ? 14 : 10} fill="none" strokeLinecap="round" />;
              })}
              {/* nose */}
              <path d={`M ${dx * 1.25 - 4} -160 Q ${dx * 1.25 + 12} -146 ${dx * 1.25 - 2} -136`} stroke={shade(L.skin, 0.3)}
                strokeWidth={5 * ks} fill="none" strokeLinecap="round" />
              {L.age ? [-1, 1].map((s) => (
                <path key={s} d={`M ${s * 94 + dx} -198 l ${s * 14} -6 M ${s * 94 + dx} -182 l ${s * 14} 5`}
                  stroke={shade(L.skin, 0.28)} strokeWidth={3.5 * ks} strokeLinecap="round" />
              )) : null}
              {/* a touch of colour on the cheeks */}
              {[-1, 1].map((s) => <ellipse key={s} cx={s * 100 + dx} cy={-128} rx={26} ry={13} fill="#F2A08F"
                opacity={0.22} />)}
            </g>
          )}
          <Mouth e={e} talking={Boolean(p.talking)} v={p.mouth ?? 0} mx={dx * 1.1} my={RIG.mouthY} light={lightMouth} />
          {p.id === "father" ? (
            // half-moon reading glasses low on the nose (the eyes look over them)
            <g transform={`translate(${dx * 1.15} 0)`}>
              {[-1, 1].map((s) => (
                <path key={s} d={`M ${s * 18} -150 L ${s * 96} -150 C ${s * 96} -114 ${s * 18} -110 ${s * 18} -150 Z`}
                  fill="rgba(220,236,245,0.32)" stroke={INK} strokeWidth={5 * ks} strokeLinejoin="round" />
              ))}
              <path d="M -18 -148 Q 0 -160 18 -148" stroke={INK} strokeWidth={5 * ks} fill="none" />
              <path d="M -96 -150 L -150 -166 M 96 -150 L 150 -166" stroke={INK} strokeWidth={4 * ks} />
            </g>
          ) : null}
          {(p.shadowHalf ?? 0) > 0 ? (
            // the fake banker: half the face in shadow
            <g clipPath={`url(#${faceId})`} opacity={0.62 * (p.shadowHalf ?? 0)}>
              <path d="M 10 -420 L 220 -420 L 220 0 L -40 0 Z" fill="#14161C" />
            </g>
          ) : null}
        </g>
      ) : null}
      <HairFront id={p.id} L={L} dx={dx} back={back} />
      {p.id === "scammer" ? (
        // headset: band over the hood, ear cup on the near side, the mic boom to the mouth
        <g>
          <path d="M -206 -230 C -200 -420 200 -420 206 -230" stroke={INK} strokeWidth={22} fill="none" strokeLinecap="round" />
          <path d="M -206 -230 C -200 -420 200 -420 206 -230" stroke="#4A4F5C" strokeWidth={12} fill="none" strokeLinecap="round" />
          <rect x={-232} y={-262} width={52} height={92} rx={22} fill="#3A3F4B" stroke={INK} strokeWidth={lw} />
          <circle cx={-206} cy={-190} r={6} fill={L.accent} />
          <path d="M -206 -186 C -200 -110 -140 -92 -62 -96" stroke={INK} strokeWidth={14} fill="none" strokeLinecap="round" />
          <path d="M -206 -186 C -200 -110 -140 -92 -62 -96" stroke="#4A4F5C" strokeWidth={7 * ks} fill="none" strokeLinecap="round" />
          <ellipse cx={-56} cy={-96} rx={18} ry={14} fill="#2A2D36" stroke={INK} strokeWidth={4.5 * ks} />
        </g>
      ) : null}
      <FxLayer fx={back ? fx.filter((f) => f === "sweat" || f === "shockLines" || f === "question") : fx} dx={dx}
        light={Boolean(p.rim)} frame={frame} />
    </g>
  );

  return (
    <InkContext.Provider value={ink}>
    <svg width={box.w} height={box.h} style={{position: "absolute", left: 0, top: 0, overflow: "visible", ...style,
      filter: [rimCss, style?.filter].filter(Boolean).join(" ") || undefined}}>
      <g transform={`translate(${p.x} ${p.y}) scale(${p.k}) rotate(${p.lean ?? 0} 0 ${B.sole})`}>
        <FloorShadow B={B} uid={uid} />
        <Legs B={B} cloth={legs.cloth} legFill={silhouette ? "#5A606E" : L.skin} feet="shoes" foot={legs.shoe}
          back={back} />
        {/* the upper body squashes and breathes over the hem; the legs stay planted */}
        <g transform={squashAt(B, squash, breathe)}>
          {/* neck */}
          <rect x={-40} y={-74} width={80} height={90} rx={20} fill={silhouette ? "#14161B" : skinShade} stroke={INK}
            strokeWidth={lw} />
          {/* torso + costume, the shadow tone on the right */}
          <defs><clipPath id={torsoId}><path d={torsoPath(B)} /></clipPath></defs>
          <path d={torsoPath(B)} fill={L.top} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
          <g clipPath={`url(#${torsoId})`}>
            <Costume id={p.id} L={L} B={B} back={back} uid={uid} />
            <path d={sideShade(B)} fill="#000" opacity={0.12} />
            {silhouette && (p.monitor ?? 0) > 0 ? (
              <ellipse cx={240} cy={160} rx={160} ry={260} fill={L.accent} opacity={0.16 * (p.monitor ?? 0)} />
            ) : null}
          </g>
          {!high(arms.L) ? armEl("L") : null}
          {!high(arms.R) && !back ? armEl("R") : null}
          {holding ? (
            <g transform={`translate(0 ${RIG.hands.phoneRead.L[1] - 40}) rotate(-4)`}>
              <Phone2 glow />
            </g>
          ) : null}
          {holding ? (
            // the hands go over the phone's edges again
            <>
              {arms.L ? <Hand at={arms.L.ha} from={arms.L.el} shape="mitten" skin={silhouette ? "#5A606E" : L.skin} side={-1} /> : null}
              {arms.R ? <Hand at={arms.R.ha} from={arms.R.el} shape="mitten" skin={silhouette ? "#5A606E" : L.skin} side={1} /> : null}
            </>
          ) : null}
          {head}
          {back ? (
            <g>
              <g transform={`translate(${RIG.back.phone[0]} ${RIG.back.phone[1]}) rotate(8)`}>
                <Phone2 screen={p.screen} glow />
              </g>
              {armEl("R")}
            </g>
          ) : null}
          {high(arms.L) ? armEl("L") : null}
          {high(arms.R) && !back ? armEl("R") : null}
        </g>
      </g>
    </svg>
    </InkContext.Provider>
  );
};
