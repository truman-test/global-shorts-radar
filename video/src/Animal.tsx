// The animal cast (동물 캐스트): a second skin over the same rig, poses and stagings as Character.tsx (cast_style
// "animal"). Our own designs, drawn only in code: a 진돗개 family (아빠 a white Jindo with half-moon reading glasses,
// grey bushy brows and a cardigan; 엄마 a tan 누렁이 with a permed curly tuft between the ears and a cardigan; 딸 and
// 아들 younger, in casual / office clothes) and 여우 callers (the scammer, a rust fox in a dark hoodie with the hood
// down and a headset, face visible: narrow eyes, sly grin; the fake banker, a silver-grey fox in a suit with a blank
// staff badge; the ad presenter in a shiny suit). Grown-up, muted palette (no candy colours), the channel's ink: a
// fixed on-screen #2B2620 outline (Body.tsx), flat fills plus one shadow tone, the rim light on dark stages. Rounder
// anatomy than the humans: soft curved sleeves, round paws, the same SD body (Body.tsx) on paws instead of shoes.
// Faces read at bust size: eyes with whites ~17% of the head height and a highlight, a longer Jindo muzzle (a dog, not
// a bear), a shocked mouth 30-40% of the face wide with teeth and tongue; adult cues (brows, glasses, perm, lids).
// The head stays inside the rig's head box (composition.json "animal", tests/test_characters.py), the eyes sit on
// rig.eyeY and the mouth on rig.mouthY, so every staging's composition rules hold for both skins.
// Every value comes from the pose (a pure function of the frame).
import React from "react";
import COMP from "./composition.json";
import {RIG} from "./rig";
import {BodySpec, bodyOf, FloorShadow, InkContext, inkFor, LEG_LOOKS, Legs, shoulderOf, torsoPath, useInk} from "./Body";
import {ArmSpec, armsOf, backArms, browSet, CharPose, Cloud, Costume, FxLayer, INK, LOOKS, Mouth, MOUTH_IN, P, Phone2,
  Pt, shade, sideShade, SLEEVE, squashAt, TONGUE} from "./Character";
import {CharacterId, Expression} from "./types";

const A = COMP.animal;
const T = A.earTip;
const W = A.halfWidth;

type Species = "dog" | "fox";
export type Fur = {species: Species; fur: string; mask: string; earIn: string; brow: string; paw: string; pad: string;
  young: boolean; tip?: string};

/** Fur palettes: muted, grown-up tones (no candy colours); the foxes' rust is dulled toward brown. */
export const FURS: Record<CharacterId, Fur> = {
  father: {species: "dog", fur: "#F0EBE1", mask: "#FFFDF8", earIn: "#D9C3B6", brow: "#9C968C", paw: "#F0EBE1",
    pad: "#B89184", young: false},
  mother: {species: "dog", fur: "#C69460", mask: "#F2E3C7", earIn: "#EAD4B4", brow: "#7E5832", paw: "#C69460",
    pad: "#8E6448", young: false},
  daughter: {species: "dog", fur: "#D7AC78", mask: "#F6E9D1", earIn: "#EFDABF", brow: "#8A6038", paw: "#D7AC78",
    pad: "#93694C", young: true},
  son: {species: "dog", fur: "#E7D8BE", mask: "#FBF6EC", earIn: "#DCC2AC", brow: "#7A6450", paw: "#E7D8BE",
    pad: "#A68474", young: true},
  scammer: {species: "fox", fur: "#A45E3A", mask: "#EEE2CF", earIn: "#E2CDB6", brow: "#4E2E1E", paw: "#3B2B24",
    pad: "#5A463C", young: false, tip: "#3B2B24"},
  // a silver-grey fox: at a glance not the rust scammer
  fake_banker: {species: "fox", fur: "#A29C94", mask: "#F2EFEA", earIn: "#E2DCD4", brow: "#45403B", paw: "#3A3633",
    pad: "#57514C", young: false, tip: "#3A3633"},
  ad: {species: "fox", fur: "#BC7A4A", mask: "#F2E8D8", earIn: "#E8D4BE", brow: "#5A3622", paw: "#3B2B24",
    pad: "#5A463C", young: false, tip: "#3B2B24"},
};

/* ------------------------------------------------------------------ head shapes */

/** A superellipse head: `nTop`/`nBot` squareness above/below the centre, `pinch` narrows the lower half (the fox's
 * tapering muzzle). */
const headPath = (cy: number, top: number, bottom: number, nTop: number, nBot: number, pinch: number) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const lower = s > 0;
    const n = lower ? nBot : nTop;
    let x = 158 * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = cy + (lower ? bottom - cy : cy - top) * Math.sign(s) * Math.abs(s) ** (2 / n);
    if (lower) x *= 1 - pinch * s ** 1.6;
    pts.push([x, y]);
  }
  return P(pts);
};
const HEADS: Record<Species, string> = {
  dog: headPath(-200, A.skullTop, A.jowl, 2.3, 2.75, 0.05),
  fox: headPath(-204, A.skullTop + 4, A.jowl + 2, 2.4, 1.8, 0.4),
};

/** An ear (side s = -1 viewer's left, 1 right): base on the skull, tip at the rig's head top. */
const earPath = (sp: Species, s: number, inner: boolean) => {
  if (sp === "dog") {
    return inner
      ? `M ${s * 70} -306 C ${s * 82} -346 ${s * 102} -384 ${s * 118} -392 C ${s * 132} -386 ${s * 140} -340 ${s * 140} -288 Z`
      : `M ${s * 40} -312 C ${s * 58} -360 ${s * 90} ${T + 14} ${s * 106} ${T + 3} Q ${s * 122} ${T - 4} ${s * 134} ${T + 8}
        C ${s * 154} -350 ${s * 164} -320 ${s * 162} -262 Z`;
  }
  return inner
    ? `M ${s * 62} -300 C ${s * 80} -344 ${s * 112} -384 ${s * 132} -390 C ${s * 148} -380 ${s * 156} -330 ${s * 154} -268 Z`
    : `M ${s * 28} -306 C ${s * 54} -364 ${s * 110} ${T + 2} ${s * 134} ${T} C ${s * 164} ${T + 4} ${s * 182} -330 ${s * 176} -238 Z`;
};

/** The fox's cream cheek fur poking out at the sides (behind the face outline): two short points. */
const cheekPath = (s: number) => `M ${s * 118} -186 Q ${s * 150} -160 ${s * (W - 18)} -142 Q ${s * 158} -132 ${s * 146}
  -122 Q ${s * 166} -110 ${s * (W - 26)} -96 Q ${s * 132} -92 ${s * 100} -98 Z`;

/** The fox's cream mask: lower cheeks and chin, with the rust bridge of the nose running down the middle. */
const FOX_MASK = "M -190 -168 C -132 -176 -84 -160 -52 -134 C -34 -120 -22 -146 0 -150 C 22 -146 34 -120 52 -134 C 84 -160 132 -176 190 -168 L 190 0 L -190 0 Z";

/** The Jindo muzzle: a pale snout from between the eyes down to the chin, wider at the mouth (a dog's long muzzle
 * seen from the front, not a bear's round button). */
const MUZZLE = `M -30 ${A.muzzle.top} C -34 -150 -72 -138 -92 -116 C -${A.muzzle.halfWidth + 8} -96 -${A.muzzle.halfWidth} -50 -70 -40
  C -40 ${A.muzzle.bottom + 4} 40 ${A.muzzle.bottom + 4} 70 -40 C ${A.muzzle.halfWidth} -50 ${A.muzzle.halfWidth + 8} -96 92 -116
  C 72 -138 34 -150 30 ${A.muzzle.top} Q 0 ${A.muzzle.top - 8} -30 ${A.muzzle.top} Z`;

/** The perm: a curly tuft between the ears (circles under one outline). */
const PERM: [number, number, number][] = [[-78, -346, 34], [-40, -368, 37], [0, -374, 37], [40, -368, 37],
  [78, -350, 34], [-20, -346, 36], [24, -346, 36]];

/* ------------------------------------------------------------------ paws and arms */

const PawHand: React.FC<{at: Pt; from: Pt; shape: string; F: Fur; side: number}> = ({at, from, shape, F, side}) => {
  const {lw, ks} = useInk();
  const [x, y] = at;
  const ang = (Math.atan2(y - from[1], x - from[0]) * 180) / Math.PI;
  const R = RIG.handR;
  const sk = {fill: F.paw, stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const};
  const toe = {stroke: INK, strokeWidth: 3.5 * ks, strokeLinecap: "round" as const, fill: "none"};
  // two short toe seams at the paw's tip (in the direction of the forearm)
  const seams = <path d={`M ${R * 0.42} ${-R * 0.3} L ${R * 0.88} ${-R * 0.3} M ${R * 0.42} ${R * 0.3} L ${R * 0.88} ${R * 0.3}`}
    {...toe} />;
  switch (shape) {
    case "point":
      return (
        <g transform={`translate(${x} ${y}) rotate(${ang})`}>
          <rect x={R * 0.35} y={-14} width={R * 1.35} height={28} rx={14} {...sk} />
          <ellipse rx={R * 0.95} ry={R * 0.88} {...sk} />
          <path d={`M ${R * 0.3} ${R * 0.36} L ${R * 0.8} ${R * 0.36}`} {...toe} />
        </g>
      );
    case "palm":
      // the paw pad to the viewer: a clear "stop" (toe beans + the main pad)
      return (
        <g transform={`translate(${x} ${y}) scale(1.3)`}>
          {[[-0.64, -0.86], [-0.23, -1.08], [0.23, -1.08], [0.64, -0.86]].map(([tx, ty], i) => (
            <circle key={i} cx={tx * R} cy={ty * R} r={R * 0.34} {...sk} />
          ))}
          <ellipse rx={R * 0.98} ry={R * 0.9} {...sk} />
          {[[-0.64, -0.86], [-0.23, -1.08], [0.23, -1.08], [0.64, -0.86]].map(([tx, ty], i) => (
            <ellipse key={i} cx={tx * R} cy={ty * R + 2} rx={R * 0.17} ry={R * 0.2} fill={F.pad} />
          ))}
          <path d={`M ${-R * 0.5} ${R * 0.05} C ${-R * 0.5} ${-R * 0.42} ${R * 0.5} ${-R * 0.42} ${R * 0.5} ${R * 0.05}
            C ${R * 0.5} ${R * 0.42} ${-R * 0.5} ${R * 0.42} ${-R * 0.5} ${R * 0.05} Z`} fill={F.pad} />
        </g>
      );
    case "fist":
      return (
        <g transform={`translate(${x} ${y}) rotate(${side * 10})`}>
          <ellipse rx={R * 0.95} ry={R * 0.85} {...sk} />
          <path d={`M ${-R * 0.3} ${-R * 0.82} v ${R * 0.4} M ${R * 0.3} ${-R * 0.82} v ${R * 0.4}`} {...toe} />
        </g>
      );
    case "cheek":
      return (
        <g transform={`translate(${x} ${y}) rotate(${-side * 8})`}>
          <ellipse rx={R * 0.82} ry={R * 1.06} {...sk} />
          <path d={`M ${-R * 0.25} ${-R * 1.0} v ${R * 0.4} M ${R * 0.25} ${-R * 1.0} v ${R * 0.4}`} {...toe} />
        </g>
      );
    case "onHead":
      return (
        <g transform={`translate(${x} ${y}) rotate(${side * -30})`}>
          <ellipse rx={R * 1.02} ry={R * 0.8} {...sk} />
          <path d={`M ${-R * 0.3} ${R * 0.78} v ${-R * 0.38} M ${R * 0.3} ${R * 0.78} v ${-R * 0.38}`} {...toe} />
        </g>
      );
    default:
      return (
        <g transform={`translate(${x} ${y}) rotate(${ang})`}>
          <ellipse rx={R * 0.98} ry={R * 0.9} {...sk} />
          {seams}
        </g>
      );
  }
};

const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A soft sleeve: one quadratic curve from the shoulder through (near) the elbow to the paw, so the arm bends in a
 * round line instead of two stiff segments. */
const PawArm: React.FC<{spec: ArmSpec; side: number; B: BodySpec; color: string; F: Fur}> = ({spec, side, B, color, F}) => {
  const {lw} = useInk();
  const sh: Pt = shoulderOf(B, side);
  const mid = lerp(sh, spec.ha, 0.5);
  const c: Pt = [spec.el[0] + (spec.el[0] - mid[0]) * 0.4, spec.el[1] + (spec.el[1] - mid[1]) * 0.4];
  const d = `M ${sh[0]} ${sh[1]} Q ${c[0]} ${c[1]} ${spec.ha[0]} ${spec.ha[1]}`;
  // the cuff: the sleeve's end, one shade darker, under the paw
  const t = 0.8;
  const q = lerp(lerp(sh, c, t), lerp(c, spec.ha, t), t);
  const hand = spec.shape === "phoneEar" || spec.shape === "hold" || spec.shape === "holdOne" ? "mitten" : spec.shape;
  return (
    <g>
      <path d={d} stroke={INK} strokeWidth={SLEEVE + lw * 2} fill="none" strokeLinecap="round" />
      <path d={d} stroke={color} strokeWidth={SLEEVE} fill="none" strokeLinecap="round" />
      <path d={`M ${q[0]} ${q[1]} Q ${lerp(c, spec.ha, t)[0]} ${lerp(c, spec.ha, t)[1]} ${spec.ha[0]} ${spec.ha[1]}`}
        stroke={shade(color, 0.16)} strokeWidth={SLEEVE} fill="none" strokeLinecap="butt" />
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
      <PawHand at={spec.ha} from={spec.el} shape={hand} F={F} side={side} />
    </g>
  );
};

/* ------------------------------------------------------------------ face parts */

/**
 * An animal eye readable at bust size: a white (17% of the head height) with an ink outline heavier along the top lid
 * (a grown-up look, not a baby's button), a dark iris that follows `look`, two highlights. Expressions: a shrunken pupil
 * (shocked), a big wet iris (panicked), happy arcs (relieved, fakeKind), a straight lid (suspicious, smug: `fur` is the
 * lid's colour), blinks as a lid coming down.
 */
const AnimalEye: React.FC<{cx: number; cy: number; e: Expression; blink: number; look: [number, number]; far: number;
  side: number; fur: string}> = ({cx, cy, e, blink, look, far, side, fur}) => {
  const {lw, ks} = useInk();
  const sx = 1 - 0.16 * far;
  const rx = A.eye.rx;
  const ry = A.eye.ry;
  const line = {stroke: INK, strokeWidth: 8 * ks, fill: "none", strokeLinecap: "round" as const};
  const g = (child: React.ReactNode) => <g transform={`translate(${cx} ${cy}) scale(${sx} 1)`}>{child}</g>;
  if (e === "relieved" || e === "fakeKind") return g(<path d={`M ${-rx} 8 Q 0 -22 ${rx} 8`} {...line} />);
  // wide-eyed faces never blink (like the human Eye): the twist freezes on a shocked face, never on a blink
  if (e === "shocked" || e === "panicked") blink = 0;
  const sly = e === "suspicious" || e === "smug";
  if (blink > 0.5 && !sly) return g(<path d={`M ${-rx} 0 Q 0 14 ${rx} 0`} {...line} />);
  if (e === "shocked") {
    return g(
      <>
        <ellipse rx={rx + 4} ry={ry + 5} fill="#FFFFFF" stroke={INK} strokeWidth={lw} />
        <circle cx={look[0] * 5} cy={look[1] * 5} r={8} fill={INK} />
        <circle cx={look[0] * 5 - 3} cy={look[1] * 5 - 3} r={2.4} fill="#FFFFFF" />
      </>,
    );
  }
  const big = e === "excited" || e === "panicked";
  const irx = big ? 20 : e === "worried" ? 16 : 18;
  const iry = big ? 25 : e === "worried" ? 20 : 23;
  const lx = look[0] * (rx - irx - 1);
  const ly = look[1] * (ry - iry - 2) + (e === "worried" ? -3 : 0);
  // the top lid: down a little for a blink in progress; straight and low for the sly looks
  const lidY = sly ? (e === "smug" ? -4 : -8) : -ry - 2 + blink * 1.3 * ry;
  const tilt = e === "suspicious" ? -side * 5 : e === "smug" ? side * 4 : 0;
  const lidHalf = (y: number) => rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2));
  const lid = lidY > -ry + 2 ? (
    <g>
      <path d={`M ${-rx - 8} ${-ry - 10} L ${rx + 8} ${-ry - 10} L ${rx + 8} ${lidY + tilt} L ${-rx - 8} ${lidY - tilt} Z`}
        fill={fur} />
      <path d={`M ${-lidHalf(lidY) - 4} ${lidY - tilt * 0.9} L ${lidHalf(lidY) + 4} ${lidY + tilt * 0.9}`} {...line}
        strokeWidth={lw * 1.3} />
    </g>
  ) : null;
  return g(
    <>
      <ellipse rx={rx} ry={ry} fill="#FFFFFF" stroke={INK} strokeWidth={lw} />
      <ellipse cx={lx} cy={ly} rx={irx} ry={iry} fill="#2A211C" />
      <circle cx={lx - irx * 0.32} cy={ly - iry * 0.38} r={big ? 7.5 : 6.5} fill="#FFFFFF" />
      <circle cx={lx + irx * 0.34} cy={ly + iry * 0.36} r={big ? 3.6 : 3} fill="#FFFFFF" />
      {e === "panicked" ? <path d={`M ${-rx + 4} ${ry - 2} Q 0 ${ry + 10} ${rx - 4} ${ry - 2}`} stroke="#8CC8FF"
        strokeWidth={6 * ks} fill="none" strokeLinecap="round" /> : null}
      {/* the heavier top lid line (grown-up eyes) */}
      {lid ?? <path d={`M ${-rx - 1} ${-4} A ${rx} ${ry} 0 0 1 ${rx + 1} ${-4}`} {...line} strokeWidth={lw * 1.35} />}
      {e === "smug" ? <path d={`M ${-rx} ${ry * 0.55} Q 0 ${ry * 0.2} ${rx} ${ry * 0.55} L ${rx + 6} ${ry + 8}
        L ${-rx - 6} ${ry + 8} Z`} fill={fur} /> : null}
    </>,
  );
};

/** The fox's narrow eyes: a fur-coloured lid over the top of the eye, its edge slanting down to the nose (sly) or up
 * (worried). Drawn over AnimalEye. */
const FoxLid: React.FC<{cx: number; cy: number; e: Expression; side: number; fur: string; blink: number}> = ({cx, cy,
  e, side, fur, blink}) => {
  const {ks} = useInk();
  if (!["neutral", "worried", "excited", "panicked"].includes(e) || blink > 0.5) return null;
  const inner = e === "worried" || e === "panicked" ? -20 : e === "excited" ? -15 : -2;
  const outer = e === "worried" || e === "panicked" ? -6 : e === "excited" ? -20 : -17;
  const r = A.eye.rx + 4;
  const xi = -side * r;
  const xo = side * r;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <path d={`M ${xo} ${-A.eye.ry - 12} L ${xi} ${-A.eye.ry - 12} L ${xi} ${inner} L ${xo} ${outer} Z`} fill={fur} />
      <path d={`M ${xi + side * 3} ${inner} L ${xo + side * 4} ${outer - 2}`} stroke={INK} strokeWidth={8.5 * ks}
        strokeLinecap="round" />
    </g>
  );
};

/** Nose, the line under it, and the mouth: the ω of a resting dog; the shared talking mouths, a little larger on the
 * muzzle; a big shocked mouth (30-40% of the face wide, teeth and tongue); the fox's smug grin shows a fang. */
const Snout: React.FC<{sp: Species; e: Expression; talking: boolean; v: number; dx: number}> = ({sp, e, talking, v,
  dx}) => {
  const {lw, ks} = useInk();
  const nx = dx * 1.25;
  const mx = dx * 1.15;
  const ny = sp === "dog" ? A.nose : A.nose + 8;
  const nw = sp === "dog" ? 34 : 19;
  const nh = sp === "dog" ? 28 : 19;
  const st = {stroke: INK, strokeWidth: lw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    fill: "none"};
  const omega = !talking && (e === "neutral" || (sp === "dog" && e === "suspicious"));
  const shocked = !talking && e === "shocked";
  const my = RIG.mouthY + 16;
  const sc = 1.22;
  const mouthTop = ny + nh * 0.6;
  let mouth: React.ReactNode;
  if (shocked) {
    const rx = A.shockedMouth[sp];
    const ry = 33;
    const cy = -78;
    mouth = (
      <g transform={`translate(${mx} ${cy})`}>
        <ellipse rx={rx} ry={ry} fill={MOUTH_IN} stroke={INK} strokeWidth={lw} />
        <path d={`M ${-rx * 0.74} ${-ry * 0.62} Q 0 ${-ry * 1.02} ${rx * 0.74} ${-ry * 0.62} L ${rx * 0.66} ${-ry * 0.3}
          Q 0 ${-ry * 0.52} ${-rx * 0.66} ${-ry * 0.3} Z`} fill="#FFFFFF" />
        <path d={`M ${-rx * 0.62} ${ry * 0.62} Q 0 ${-ry * 0.05} ${rx * 0.62} ${ry * 0.62} Q 0 ${ry * 1.02} ${-rx * 0.62}
          ${ry * 0.62} Z`} fill={TONGUE} />
        <ellipse rx={rx} ry={ry} fill="none" stroke={INK} strokeWidth={lw} />
      </g>
    );
  } else if (omega) {
    mouth = (
      <path d={`M ${mx - 32} ${RIG.mouthY - 2} Q ${mx - 15} ${RIG.mouthY + 14} ${mx} ${RIG.mouthY - 6}
        Q ${mx + 15} ${RIG.mouthY + 14} ${mx + 32} ${RIG.mouthY - 2}`} {...st} />
    );
  } else {
    mouth = (
      <g transform={`translate(${mx} ${my}) scale(${sc}) translate(${-mx} ${-my})`}>
        <Mouth e={e} talking={talking} v={v} mx={mx} my={my} />
      </g>
    );
  }
  return (
    <g>
      {/* the line from the nose down to the mouth */}
      {shocked ? null : <path d={`M ${nx} ${mouthTop} Q ${(nx + mx) / 2} ${ny + nh} ${mx} ${RIG.mouthY - 6}`} {...st}
        strokeWidth={5 * ks} />}
      {mouth}
      {sp === "fox" && !talking && e === "smug" ? (
        <path d={`M ${mx + 4} ${my + 1} l 8 15 l 7 -16 Z`} fill="#FFFDF8" stroke={INK} strokeWidth={3 * ks}
          strokeLinejoin="round" />
      ) : null}
      <path d={`M ${nx - nw} ${ny - nh * 0.45} Q ${nx} ${ny - nh * 0.8} ${nx + nw} ${ny - nh * 0.45} Q ${nx + nw * 1.05}
        ${ny + nh * 0.2} ${nx} ${ny + nh * 0.6} Q ${nx - nw * 1.05} ${ny + nh * 0.2} ${nx - nw} ${ny - nh * 0.45} Z`}
        fill="#2E2622" stroke={INK} strokeWidth={4 * ks} strokeLinejoin="round" />
      <ellipse cx={nx - nw * 0.35} cy={ny - nh * 0.32} rx={nw * 0.3} ry={nh * 0.14} fill="#FFFFFF" opacity={0.55} />
    </g>
  );
};

/* ------------------------------------------------------------------ the animal character */

/**
 * One animal character in its own <svg>, the same props and coordinates as Character (Character.tsx). The scammer
 * keeps a visible face here (narrow eyes, sly grin): the monitor's teal light falls on it instead of a hood's shadow.
 */
export const AnimalCharacter: React.FC<{pose: CharPose; uid: string; box?: {w: number; h: number}; frame: number;
  style?: React.CSSProperties}> = ({pose, uid, box = {w: 1080, h: 1920}, frame, style}) => {
  const p = pose;
  // the ad presenter's suit is a shiny silver-blue here (the two foxes in suits must not look alike)
  const L = p.id === "ad" ? {...LOOKS.ad, top: "#6F7C92"} : LOOKS[p.id];
  const F = FURS[p.id];
  const sp = F.species;
  const B = bodyOf(p.id);
  const ink = inkFor(p.px ?? p.k);
  const {lw, ks} = ink;
  const legs = LEG_LOOKS[p.id];
  const back = p.view === "back";
  const turn = Math.max(-1, Math.min(1, p.turn ?? 0));
  const dx = turn * 28;
  const far = Math.abs(turn);
  const e = p.expr;
  const fx = p.fx ?? [];
  const gesture = p.gesture ?? "rest";
  const arms = back ? backArms() : armsOf(gesture, Boolean(p.mirror), p.free, p.typing ?? frame);
  const high = (a?: ArmSpec) => Boolean(a && a.ha[1] < -20);
  const holding = !back && (gesture === "phoneRead" || gesture === "phoneType");
  const breathe = 1 + 0.012 * (p.breathe ?? 0);
  const squash = p.squash ?? 1;
  const tilt = (p.tilt ?? 0) + (p.nod ?? 0);
  const rimPx = p.rim ? p.rimWidth ?? 7 : 0;
  const rimCss = p.rim ? [[rimPx, 0], [-rimPx, 0], [0, rimPx], [0, -rimPx]]
    .map(([a, c]) => `drop-shadow(${a}px ${c}px 0 ${p.rim}E6)`).join(" ") : "";
  const headD = HEADS[sp];
  const look: [number, number] = p.look ?? [0, 0];
  const furShade = shade(F.fur);
  const faceId = `${uid}-aface`;
  const torsoId = `${uid}-atorso`;
  const brows = browSet(e);
  const earDx = -turn * 14;
  const kid = F.young ? A.kidHead : 1;
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const};

  const armEl = (side: "L" | "R") => {
    const a = arms[side];
    return a ? <PawArm key={side} spec={a} side={side === "L" ? -1 : 1} B={B} color={L.top} F={F} /> : null;
  };

  const ears = (
    <g transform={`translate(${earDx} 0)`}>
      {[-1, 1].map((s) => (
        <g key={s}>
          <path d={earPath(sp, s, false)} fill={back ? furShade : F.fur} {...st} />
          {back ? null : <path d={earPath(sp, s, true)} fill={F.earIn} />}
          {F.tip ? (
            <g>
              <clipPath id={`${uid}-tip${s}`}><path d={earPath(sp, s, false)} /></clipPath>
              <rect x={-220} y={T - 10} width={440} height={52} fill={F.tip} clipPath={`url(#${uid}-tip${s})`}
                transform={`rotate(${s * 8} ${s * 134} ${T})`} />
              <path d={earPath(sp, s, false)} fill="none" {...st} />
            </g>
          ) : null}
        </g>
      ))}
    </g>
  );

  const head = (
    <g transform={`translate(${p.shake ?? 0} 0) rotate(${tilt} 0 -60) translate(0 -30) scale(${kid}) translate(0 30)`}>
      {p.id === "scammer" ? (
        // the hood, down: a soft roll behind the neck
        <g>
          <path d="M -176 34 C -184 -24 -126 -66 0 -66 C 126 -66 184 -24 176 34 C 118 52 -118 52 -176 34 Z"
            fill={shade(L.top, -0.1)} {...st} />
          <path d="M -136 6 C -80 -26 80 -26 136 6" stroke={INK} strokeWidth={4 * ks} fill="none" strokeLinecap="round"
            opacity={0.6} />
        </g>
      ) : null}
      {ears}
      {/* cheek fur, behind the face outline */}
      {!back && sp === "fox" ? [-1, 1].map((s) => (
        <path key={s} d={cheekPath(s)} fill={F.mask} {...st} transform={`translate(${-turn * 10} 0)`} />
      )) : null}
      <defs>
        <clipPath id={faceId}><path d={headD} /></clipPath>
      </defs>
      <path d={headD} fill={F.fur} {...st} />
      <g clipPath={`url(#${faceId})`}>
        <path d={headD} fill={furShade} />
        <path d={headD} fill={F.fur} transform="translate(-14 -10)" />
        {!back && sp === "fox" ? <path d={FOX_MASK} fill={F.mask} transform={`translate(${dx * 1.1} 0)`} /> : null}
        {!back && sp === "dog" ? (
          <path d={MUZZLE} transform={`translate(${dx * 1.15} 0)`} fill={F.mask} stroke={shade(F.fur, 0.2)}
            strokeWidth={4.5 * ks} />
        ) : null}
        {!back && sp === "dog" ? [-1, 1].map((s) => (
          // the pale "eyebrow" patches of a Jindo / 누렁이 (urajiro), above each eye
          <ellipse key={s} cx={s * 64 + dx} cy={-250} rx={18} ry={10} fill={F.mask} opacity={p.id === "father" ? 0 : 0.65} />
        )) : null}
        {p.glow && p.glow.amount > 0 ? (
          <g opacity={p.glow.amount}>
            <defs>
              <radialGradient id={`${uid}-aglow`} cx={p.glow.from === "below" ? "50%" : p.glow.from === "left" ? "0%" : "100%"}
                cy={p.glow.from === "below" ? "100%" : "40%"} r="75%">
                <stop offset="0%" stopColor={p.glow.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={p.glow.color} stopOpacity={0} />
              </radialGradient>
            </defs>
            <rect x={-200} y={-400} width={400} height={400} fill={`url(#${uid}-aglow)`} />
          </g>
        ) : null}
        {fx.includes("gloom") && !back ? <rect x={-200} y={-400} width={400} height={170} fill="#6F7FD8" opacity={0.28} /> : null}
        {(p.monitor ?? 0) > 0 ? (
          // the monitor's teal light along the jaw (the screen is to the viewer's right)
          <path d={headD} fill="none" stroke={L.accent === "#5FD3C8" ? L.accent : "#5FD3C8"} strokeWidth={34}
            opacity={0.28 * (p.monitor ?? 0)} transform="translate(-16 -6)" />
        ) : null}
      </g>
      {p.id === "mother" ? (
        <Cloud circles={PERM.map(([x, y, r]) => [x + dx * 0.4, y, r] as [number, number, number])} fill="#E9D7B6"
          extra={(
            <g stroke="#B99B72" strokeWidth={4 * ks} fill="none" strokeLinecap="round">
              {PERM.slice(0, 5).map(([x, y], i) => <path key={i} d={`M ${x + dx * 0.4 - 12} ${y - 2} q 12 -12 24 0`} />)}
            </g>
          )} />
      ) : null}
      {p.id === "son" && !back ? (
        <path d={`M ${-34 + dx * 0.4} -346 Q ${-22 + dx * 0.4} -384 ${-2 + dx * 0.4} -366 Q ${8 + dx * 0.4} -392
          ${30 + dx * 0.4} -350`} fill={F.fur} {...st} />
      ) : null}
      {!back ? (
        <g>
          {[-1, 1].map((s) => (
            <g key={s}>
              <AnimalEye cx={s * RIG.eyeDX + dx} cy={RIG.eyeY} e={e} blink={p.blink ?? 0} look={look}
                far={Math.sign(turn) === s ? far : 0} side={s} fur={F.fur} />
              {sp === "fox" ? <FoxLid cx={s * RIG.eyeDX + dx} cy={RIG.eyeY} e={e} side={s} fur={F.fur}
                blink={p.blink ?? 0} /> : null}
              {p.id === "daughter" && e !== "relieved" && e !== "fakeKind" ? (
                <path d={`M ${s * RIG.eyeDX + dx + s * 20} ${RIG.eyeY - 24} l ${s * 14} -10`} stroke={INK}
                  strokeWidth={6 * ks} strokeLinecap="round" />
              ) : null}
            </g>
          ))}
          {/* brows: short tufts for the dogs (the father's grey and bushy), thin for the foxes */}
          {[-1, 1].map((s, i) => {
            const [inner, outer] = brows[i];
            const xi = s * (sp === "dog" ? 38 : 32) + dx;
            const xo = s * (sp === "dog" ? 88 : 94) + dx;
            const w = p.id === "father" ? 17 : sp === "dog" ? 12 : 9;
            return (
              <g key={s}>
                <path d={`M ${xo} ${outer} Q ${(xi + xo) / 2} ${Math.min(inner, outer) - 9} ${xi} ${inner}`}
                  stroke={F.brow} strokeWidth={w} fill="none" strokeLinecap="round" />
                {p.id === "father" ? <path d={`M ${xo - s * 6} ${outer - 4} l ${s * 12} -10 M ${(xi + xo) / 2} ${Math.min(inner, outer) - 10}
                  l ${s * 4} -12`} stroke={F.brow} strokeWidth={6 * ks} strokeLinecap="round" /> : null}
              </g>
            );
          })}
          {L.age ? [-1, 1].map((s) => (
            <path key={s} d={`M ${s * 96 + dx} -198 l ${s * 14} -6 M ${s * 96 + dx} -182 l ${s * 14} 5`}
              stroke={shade(F.fur, 0.3)} strokeWidth={3.5 * ks} strokeLinecap="round" />
          )) : null}
          {/* a touch of warmth on the cheeks (the dogs only) */}
          {sp === "dog" ? [-1, 1].map((s) => <ellipse key={s} cx={s * 108 + dx} cy={-124} rx={24} ry={12} fill="#E39A86"
            opacity={0.22} />) : null}
          <Snout sp={sp} e={e} talking={Boolean(p.talking)} v={p.mouth ?? 0} dx={dx} />
          {p.id === "father" ? (
            // half-moon reading glasses on the bridge of the muzzle (the eyes look over them)
            <g transform={`translate(${dx * 1.15} 0)`}>
              {[-1, 1].map((s) => (
                <path key={s} d={`M ${s * 20} -170 L ${s * 98} -170 C ${s * 98} -132 ${s * 20} -128 ${s * 20} -170 Z`}
                  fill="rgba(220,236,245,0.32)" stroke={INK} strokeWidth={5 * ks} strokeLinejoin="round" />
              ))}
              <path d="M -20 -168 Q 0 -180 20 -168" stroke={INK} strokeWidth={5 * ks} fill="none" />
              <path d="M -98 -170 L -152 -186 M 98 -170 L 152 -186" stroke={INK} strokeWidth={4 * ks} />
            </g>
          ) : null}
          {p.id === "daughter" ? (
            // a slate hair clip at the base of the right ear
            <g transform={`translate(${96 + earDx} -318) rotate(-28)`}>
              <rect x={-30} y={-11} width={60} height={22} rx={11} fill="#5B6B7D" stroke={INK} strokeWidth={4.5 * ks} />
              <circle cx={-12} cy={0} r={4} fill="#DCE3EA" />
            </g>
          ) : null}
          {p.id === "fake_banker" || p.id === "ad" ? (
            // slicked forehead fur with a side part
            <g>
              <path d={`M ${-96 + dx * 0.5} -300 C ${-50 + dx * 0.5} -340 ${30 + dx * 0.5} -346 ${96 + dx * 0.5} -318`}
                stroke={shade(F.fur, 0.22)} strokeWidth={12} fill="none" strokeLinecap="round" />
              <path d={`M ${-60 + dx * 0.5} -318 C ${-20 + dx * 0.5} -338 ${30 + dx * 0.5} -340 ${70 + dx * 0.5} -326`}
                stroke={shade(F.fur, -0.3)} strokeWidth={6 * ks} fill="none" strokeLinecap="round" />
            </g>
          ) : null}
          {(p.shadowHalf ?? 0) > 0 ? (
            <g clipPath={`url(#${faceId})`} opacity={0.55 * (p.shadowHalf ?? 0)}>
              <path d="M 10 -420 L 220 -420 L 220 0 L -40 0 Z" fill="#14161C" />
            </g>
          ) : null}
        </g>
      ) : null}
      {p.id === "scammer" ? (
        // headset: the band over the head between the ears, an ear cup, the mic boom to the mouth
        <g>
          <path d="M -170 -232 C -164 -382 164 -382 170 -232" stroke={INK} strokeWidth={22} fill="none" strokeLinecap="round" />
          <path d="M -170 -232 C -164 -382 164 -382 170 -232" stroke="#4A4F5C" strokeWidth={12} fill="none" strokeLinecap="round" />
          <rect x={-198} y={-262} width={52} height={92} rx={22} fill="#3A3F4B" stroke={INK} strokeWidth={lw} />
          {back ? null : (
            <g>
              <circle cx={-172} cy={-190} r={6} fill="#5FD3C8" />
              <path d="M -172 -186 C -170 -110 -130 -86 -66 -90" stroke={INK} strokeWidth={14} fill="none" strokeLinecap="round" />
              <path d="M -172 -186 C -170 -110 -130 -86 -66 -90" stroke="#4A4F5C" strokeWidth={7 * ks} fill="none" strokeLinecap="round" />
              <ellipse cx={-60} cy={-90} rx={17} ry={13} fill="#2A2D36" stroke={INK} strokeWidth={4.5 * ks} />
            </g>
          )}
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
        {sp === "fox" && p.tail ? (
          // the brush: a bushy tail out to the viewer's left behind the legs, a pale tip. Only where the feet show
          // (pose.tail: the lineup); in the stagings a desk hides it, and it made the caller shots render ~4x slower
          <g transform={`translate(${-B.hip + 20} ${B.crotch - 10}) rotate(${back ? 10 : -6})`}>
            <path d="M 20 -30 C -60 -40 -150 10 -170 110 C -176 150 -150 176 -120 160 C -96 120 -40 60 30 30 Z"
              fill={F.fur} {...st} />
            <path d="M -170 110 C -176 150 -150 176 -120 160 C -120 140 -128 120 -150 96 Z" fill={F.mask} {...st} />
          </g>
        ) : null}
        <Legs B={B} cloth={legs.cloth} legFill={F.fur} feet="paws" foot={F.paw} back={back} />
        {/* the upper body squashes and breathes over the hem; the legs stay planted */}
        <g transform={squashAt(B, squash, breathe)}>
          {/* neck (fur) */}
          <rect x={-46} y={-80} width={92} height={96} rx={24} fill={furShade} stroke={INK} strokeWidth={lw} />
          <defs><clipPath id={torsoId}><path d={torsoPath(B)} /></clipPath></defs>
          <path d={torsoPath(B)} fill={L.top} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
          <g clipPath={`url(#${torsoId})`}>
            <Costume id={p.id} L={L} B={B} back={back} uid={uid} />
            {p.id === "ad" && !back ? (
              // the shiny suit: two sheen streaks across the shoulders
              <g stroke="#FFFFFF" strokeLinecap="round" fill="none">
                <path d={`M ${-B.w + 4} 120 L ${-B.w + 120} 46`} strokeWidth={14} opacity={0.32} />
                <path d={`M ${-B.w + 10} 186 L ${-B.w + 92} 136`} strokeWidth={7} opacity={0.26} />
                <path d={`M ${B.w - 90} 60 L ${B.w - 10} 34`} strokeWidth={9} opacity={0.22} />
              </g>
            ) : null}
            <path d={sideShade(B)} fill="#000" opacity={0.12} />
            {(p.monitor ?? 0) > 0 ? (
              <ellipse cx={240} cy={160} rx={160} ry={260} fill="#5FD3C8" opacity={0.14 * (p.monitor ?? 0)} />
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
            <>
              {arms.L ? <PawHand at={arms.L.ha} from={arms.L.el} shape="mitten" F={F} side={-1} /> : null}
              {arms.R ? <PawHand at={arms.R.ha} from={arms.R.el} shape="mitten" F={F} side={1} /> : null}
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
