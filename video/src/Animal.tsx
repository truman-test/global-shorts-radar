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
// A caller with a cast costume (pose.costume) wears that disguise instead of his usual clothes (Disguise.tsx): the
// same fox every episode, a different outfit per scam, and the disguise always leaks.
// Parametric (2026-10-14 owner decision: characters are made per story): every character is a registry spec
// (content/characters/<id>.json, registry.ts) drawn on a species template (Species.tsx: dog, fox, cat, rabbit, bear,
// raccoon) with its palette, age cues (young head, wrinkles, grey brows, glasses, hair, cap, clip), outfit and prop;
// the seven legacy characters are specs too and draw exactly as before.
// Every value comes from the pose (a pure function of the frame).
import React from "react";
import COMP from "./composition.json";
import {RIG} from "./rig";
import {BodySpec, FloorShadow, InkContext, inkFor, Legs, shoulderOf, torsoPath, useInk} from "./Body";
import {ArmSpec, armsOf, backArms, browSet, CharPose, Costume, FxLayer, INK, Look, Mouth, MOUTH_IN, Phone2,
  Pt, shade, sideShade, SLEEVE, squashAt, TONGUE} from "./Character";
import {DisguiseBehind, DisguiseHead, DisguiseNeck, DisguiseSide, DisguiseTorso, earHidden, earTransform, headset,
  hooded, legsOf, lookOf, maskArm, Pointer, slicked} from "./Disguise";
import {bodyOfSpec, specOf} from "./registry";
import {blush, BodyProp, browGeom, cheekPath, Crescent, darkEars, earPath, earsOverHead, FaceMarkings, Hair, Hat, HEADS,
  NOSE, omegaRest, Outfit, RoundGlasses, Tail, Whiskers} from "./Species";
import {CharacterId, CharacterSpec, Expression, OutfitType, Species} from "./types";

const A = COMP.animal;
const T = A.earTip;

export type Fur = {species: Species; fur: string; mask: string; earIn: string; brow: string; paw: string; pad: string;
  young: boolean; tip?: string};

/** The fur of a registry spec (muted, grown-up palettes; see content/characters/README.md). */
export const furOf = (S: CharacterSpec): Fur => ({species: S.species, fur: S.palette.fur, mask: S.palette.muzzle,
  earIn: S.palette.innerEar, brow: S.palette.brow, paw: S.palette.paw, pad: S.palette.pad, young: Boolean(S.age?.young),
  tip: S.palette.earTip ?? undefined});

/** The clothes of a registry spec as the rig's Look (only top / inner / accent / age are read by the animal skin). */
export const lookOfSpec = (S: CharacterSpec): Look => ({skin: S.palette.fur, hair: S.hair?.color ?? S.palette.fur,
  brow: S.palette.brow, top: S.outfit.top, inner: S.outfit.inner, accent: S.outfit.accent, face: "round", build: 1,
  age: Boolean(S.age?.wrinkles)});

/** The legacy outfits are the human rig's costume layers (Character.tsx Costume, keyed by the legacy id). */
const LEGACY_OUTFIT: Partial<Record<OutfitType, string>> = {cardigan: "father", blouseCardigan: "mother",
  officeLanyard: "daughter", hoodie: "son", darkHoodie: "scammer", suitBadge: "fake_banker", suit: "ad"};

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
const PawArm: React.FC<{spec: ArmSpec; side: number; B: BodySpec; color: string; F: Fur; pointer?: boolean}> = ({spec,
  side, B, color, F, pointer}) => {
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
      {pointer ? <Pointer from={spec.el} at={spec.ha} /> : null}
      <PawHand at={spec.ha} from={spec.el} shape={hand} F={F} side={side} />
    </g>
  );
};

/* ------------------------------------------------------------------ face parts */

/**
 * An animal eye readable at bust size: a white (17% of the head height) with an ink outline heavier along the top lid
 * (a grown-up look, not a baby's button), a dark iris that follows `look`, two highlights. Expressions: a shrunken pupil
 * (shocked), a big wet iris (panicked), happy arcs (relieved, fakeKind), a straight lid (suspicious, smug: `fur` is the
 * lid's colour), blinks as a lid coming down. `sleepy` (eye style of calm elders): the lid rests a little lower on the
 * quiet faces (neutral, worried), never on the wide-eyed ones.
 */
const AnimalEye: React.FC<{cx: number; cy: number; e: Expression; blink: number; look: [number, number]; far: number;
  side: number; fur: string; sleepy?: boolean}> = ({cx, cy, e, blink, look, far, side, fur, sleepy}) => {
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
  const rest = sleepy && (e === "neutral" || e === "worried") ? -ry * 0.62 : -Infinity;
  const lidY = sly ? (e === "smug" ? -4 : -8) : Math.max(rest, -ry - 2 + blink * 1.3 * ry);
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
const Snout: React.FC<{sp: Species; e: Expression; talking: boolean; v: number; dx: number; nose: string}> = ({sp, e,
  talking, v, dx, nose}) => {
  const {lw, ks} = useInk();
  const nx = dx * 1.25;
  const mx = dx * 1.15;
  const ny = NOSE[sp].y;
  const nw = NOSE[sp].w;
  const nh = NOSE[sp].h;
  const st = {stroke: INK, strokeWidth: lw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    fill: "none"};
  const omega = !talking && (e === "neutral" || (omegaRest(sp) && e === "suspicious"));
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
    const w = <path d={`M ${mx - 32} ${RIG.mouthY - 2} Q ${mx - 15} ${RIG.mouthY + 14} ${mx} ${RIG.mouthY - 6}
        Q ${mx + 15} ${RIG.mouthY + 14} ${mx + 32} ${RIG.mouthY - 2}`} {...st} />;
    // the rabbit's two front teeth peek out under the ω
    mouth = sp === "rabbit" ? (
      <g>
        {[-1, 1].map((s) => <rect key={s} x={mx + (s < 0 ? -12 : 1)} y={RIG.mouthY - 2} width={11} height={15} rx={2.5}
          fill="#FFFDF8" stroke={INK} strokeWidth={3.5 * ks} />)}
        {w}
      </g>
    ) : w;
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
        fill={nose} stroke={INK} strokeWidth={4 * ks} strokeLinejoin="round" />
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
  // the registry spec (props, else the bundled content/characters file of this id)
  const S = specOf(p.id, p.spec);
  const F = furOf(S);
  const sp = F.species;
  // the fox's disguise of the episode (Disguise.tsx); the other species never wear one
  const cos = sp === "fox" ? p.costume : undefined;
  const L = cos ? lookOf(lookOfSpec(S), cos) : lookOfSpec(S);
  const B = bodyOfSpec(S);
  const ink = inkFor(p.px ?? p.k);
  const {lw, ks} = ink;
  const legs = legsOf({cloth: S.outfit.legs, shoe: S.outfit.shoes}, cos);
  const usualHood = S.outfit.type === "darkHoodie";
  const legacyOutfit = LEGACY_OUTFIT[S.outfit.type];
  const nose = S.palette.nose ?? "#2E2622";
  const back = p.view === "back";
  const turn = Math.max(-1, Math.min(1, p.turn ?? 0));
  const dx = turn * 28;
  const far = Math.abs(turn);
  const e = p.expr;
  const fx = p.fx ?? [];
  const gesture = p.gesture ?? "rest";
  const arms0 = back ? backArms() : armsOf(gesture, Boolean(p.mirror), p.free, p.typing ?? frame);
  // the mask's stick in the right paw
  const arms = cos && !back ? {...arms0, R: maskArm(cos, e, arms0.R)} : arms0;
  const light = p.light ?? "#5FD3C8";
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
  const bushy = Boolean(S.age?.greyBrows);
  // the sly lid is the colour round the eye: the fur, or the raccoon dog's dark patch
  const lidFur = sp === "raccoon" ? S.palette.marking ?? shade(F.fur, 0.45) : F.fur;

  const armEl = (side: "L" | "R") => {
    const a = arms[side];
    return a ? <PawArm key={side} spec={a} side={side === "L" ? -1 : 1} B={B} color={L.top} F={F}
      pointer={cos === "guru" && side === "R"} /> : null;
  };

  /** One ear (outline, inner fur, dark tip); `tag` keeps the clip ids apart when an ear is drawn twice. */
  const earFur = darkEars(sp) ? S.palette.marking ?? shade(F.fur, 0.45) : F.fur;
  const ear = (s: number, tag = "") => (
    <g>
      <path d={earPath(sp, s, false)} fill={back ? shade(earFur) : earFur} {...st} />
      {back ? null : <path d={earPath(sp, s, true)} fill={F.earIn} />}
      {F.tip ? (
        <g>
          <clipPath id={`${uid}-tip${s}${tag}`}><path d={earPath(sp, s, false)} /></clipPath>
          <rect x={-220} y={T - 10} width={440} height={52} fill={F.tip} clipPath={`url(#${uid}-tip${s}${tag})`}
            transform={`rotate(${s * 8} ${s * 134} ${T})`} />
          <path d={earPath(sp, s, false)} fill="none" {...st} />
        </g>
      ) : null}
    </g>
  );

  const ears = (
    <g transform={`translate(${earDx} 0)`}>
      {[-1, 1].filter((s) => !earHidden(cos, s)).map((s) => (
        <g key={s} transform={earTransform(cos, s)}>{ear(s)}</g>
      ))}
    </g>
  );

  const head = (
    <g transform={`translate(${p.shake ?? 0} 0) rotate(${tilt} 0 -60) translate(0 -30) scale(${kid}) translate(0 30)`}>
      {hooded(usualHood, cos) ? (
        // the hood, down: a soft roll behind the neck
        <g>
          <path d="M -176 34 C -184 -24 -126 -66 0 -66 C 126 -66 184 -24 176 34 C 118 52 -118 52 -176 34 Z"
            fill={shade(L.top, -0.1)} {...st} />
          <path d="M -136 6 C -80 -26 80 -26 136 6" stroke={INK} strokeWidth={4 * ks} fill="none" strokeLinecap="round"
            opacity={0.6} />
        </g>
      ) : null}
      {earsOverHead(sp) ? null : ears}
      {/* cheek fur, behind the face outline (the fox's cream points, the cat's and the raccoon dog's fluff) */}
      {!back && cheekPath(sp, 1) ? [-1, 1].map((s) => (
        <path key={s} d={cheekPath(sp, s) ?? ""} fill={sp === "fox" ? F.mask : sp === "raccoon" ? shade(F.fur, -0.12) : F.fur}
          {...st} transform={`translate(${-turn * 10} 0)`} />
      )) : null}
      <defs>
        <clipPath id={faceId}><path d={headD} /></clipPath>
      </defs>
      <path d={headD} fill={F.fur} {...st} />
      <g clipPath={`url(#${faceId})`}>
        <path d={headD} fill={furShade} />
        <path d={headD} fill={F.fur} transform="translate(-14 -10)" />
        {/* the species' face: the fox mask, the Jindo muzzle, whisker pads, eye patches (Species.tsx) */}
        {!back ? <FaceMarkings sp={sp} S={S} dx={dx} /> : null}
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
          <path d={headD} fill="none" stroke={light} strokeWidth={34}
            opacity={0.28 * (p.monitor ?? 0)} transform="translate(-16 -6)" />
        ) : null}
      </g>
      {/* the lop ears hang over the sides of the head */}
      {earsOverHead(sp) ? ears : null}
      {/* hair on the crown: the perm, the forelock, a bun */}
      <Hair S={S} dx={dx} back={back} />
      {!back ? (
        <g>
          {[-1, 1].map((s) => (
            <g key={s}>
              <AnimalEye cx={s * RIG.eyeDX + dx} cy={RIG.eyeY} e={e} blink={p.blink ?? 0} look={look}
                far={Math.sign(turn) === s ? far : 0} side={s} fur={lidFur} sleepy={S.eyes === "sleepy"} />
              {S.eyes === "narrow" ? <FoxLid cx={s * RIG.eyeDX + dx} cy={RIG.eyeY} e={e} side={s} fur={F.fur}
                blink={p.blink ?? 0} /> : null}
              {S.eyes === "lash" && e !== "relieved" && e !== "fakeKind" ? (
                <path d={`M ${s * RIG.eyeDX + dx + s * 20} ${RIG.eyeY - 24} l ${s * 14} -10`} stroke={INK}
                  strokeWidth={6 * ks} strokeLinecap="round" />
              ) : null}
            </g>
          ))}
          {/* brows: short tufts (grey and bushy for the greyBrows elders), thin for the foxes */}
          {[-1, 1].map((s, i) => {
            const [inner, outer] = brows[i];
            const [bi, bo, bw] = browGeom(sp);
            const xi = s * bi + dx;
            const xo = s * bo + dx;
            const w = bushy ? 17 : bw;
            return (
              <g key={s}>
                <path d={`M ${xo} ${outer} Q ${(xi + xo) / 2} ${Math.min(inner, outer) - 9} ${xi} ${inner}`}
                  stroke={F.brow} strokeWidth={w} fill="none" strokeLinecap="round" />
                {bushy ? <path d={`M ${xo - s * 6} ${outer - 4} l ${s * 12} -10 M ${(xi + xo) / 2} ${Math.min(inner, outer) - 10}
                  l ${s * 4} -12`} stroke={F.brow} strokeWidth={6 * ks} strokeLinecap="round" /> : null}
              </g>
            );
          })}
          {L.age ? [-1, 1].map((s) => (
            <path key={s} d={`M ${s * 96 + dx} -198 l ${s * 14} -6 M ${s * 96 + dx} -182 l ${s * 14} 5`}
              stroke={shade(F.fur, 0.3)} strokeWidth={3.5 * ks} strokeLinecap="round" />
          )) : null}
          {/* a touch of warmth on the cheeks (not the foxes, nor the dark bear) */}
          {blush(sp) ? [-1, 1].map((s) => <ellipse key={s} cx={s * 108 + dx} cy={-124} rx={24} ry={12} fill="#E39A86"
            opacity={0.22} />) : null}
          <Whiskers sp={sp} dx={dx} />
          <Snout sp={sp} e={e} talking={Boolean(p.talking)} v={p.mouth ?? 0} dx={dx} nose={nose} />
          {S.glasses === "round" ? <RoundGlasses dx={dx} /> : null}
          {S.glasses === "halfMoon" ? (
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
          {S.clip ? (
            // a hair clip at the base of the right ear
            <g transform={`translate(${96 + earDx} -318) rotate(-28)`}>
              <rect x={-30} y={-11} width={60} height={22} rx={11} fill={S.clip} stroke={INK} strokeWidth={4.5 * ks} />
              <circle cx={-12} cy={0} r={4} fill="#DCE3EA" />
            </g>
          ) : null}
          {slicked(S.hair?.style === "slicked", cos) ? (
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
      {/* a plain cap over the crown, the ears beside it */}
      {cos ? null : <Hat S={S} dx={dx} back={back} />}
      {headset(S.prop === "headset", cos) ? (
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
      <DisguiseHead cos={cos} L={L} F={F} e={e} dx={dx} back={back} uid={uid} earDx={earDx}
        talking={Boolean(p.talking)} mouth={p.mouth ?? 0} ear={(s) => ear(s, "d")} />
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
        {/* the tail behind the legs (the fox's brush etc., Species.tsx). Only where the feet show (pose.tail: the
            lineups); in the stagings a desk hides it, and it made the caller shots render ~4x slower */}
        {p.tail ? <Tail S={S} B={B} back={back} /> : null}
        <Legs B={B} cloth={legs.cloth} legFill={F.fur} feet="paws" foot={F.paw} back={back} />
        {/* the upper body squashes and breathes over the hem; the legs stay planted */}
        <g transform={squashAt(B, squash, breathe)}>
          <DisguiseBehind cos={cos} F={F} back={back} />
          {/* neck (fur) */}
          <rect x={-46} y={-80} width={92} height={96} rx={24} fill={furShade} stroke={INK} strokeWidth={lw} />
          {back ? null : <Crescent S={S} />}
          <defs><clipPath id={torsoId}><path d={torsoPath(B)} /></clipPath></defs>
          <path d={torsoPath(B)} fill={L.top} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
          <g clipPath={`url(#${torsoId})`}>
            {cos ? <DisguiseTorso cos={cos} id={p.id as CharacterId} L={L} B={B} back={back} uid={uid} />
              : legacyOutfit ? <Costume id={legacyOutfit as CharacterId} L={L} B={B} back={back} uid={uid} />
              : <Outfit S={S} L={L} B={B} back={back} />}
            {cos ? null : <BodyProp S={S} back={back} />}
            {S.outfit.sheen && !cos && !back ? (
              // the shiny suit: two sheen streaks across the shoulders
              <g stroke="#FFFFFF" strokeLinecap="round" fill="none">
                <path d={`M ${-B.w + 4} 120 L ${-B.w + 120} 46`} strokeWidth={14} opacity={0.32} />
                <path d={`M ${-B.w + 10} 186 L ${-B.w + 92} 136`} strokeWidth={7} opacity={0.26} />
                <path d={`M ${B.w - 90} 60 L ${B.w - 10} 34`} strokeWidth={9} opacity={0.22} />
              </g>
            ) : null}
            <path d={sideShade(B)} fill="#000" opacity={0.12} />
            {(p.monitor ?? 0) > 0 ? (
              <ellipse cx={240} cy={160} rx={160} ry={260} fill={light} opacity={0.14 * (p.monitor ?? 0)} />
            ) : null}
          </g>
          <DisguiseNeck cos={cos} L={L} back={back} />
          <DisguiseSide cos={cos} back={back} />
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
