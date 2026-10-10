// The SD body both skins share (Character.tsx humans, Animal.tsx animals): ~2.7 heads tall for the parents, ~2.9 for
// the grown-up children, ~3.0 for the fox callers. A short torso with a waist (chin -> waist 0.6-0.75 head), at most
// 1.05-1.2 head widths wide, a hem, short rounded legs, shoes or paws, and a soft floor shadow (composition.json
// "bodies"). Bust shots hide the legs behind a foreground prop; full shots show the feet on the floor.
// The ink outline is a fixed width on screen (composition.json "outlinePx"): every stroke width of the rig is divided
// by the character's on-screen scale (InkContext), so a close-up does not get a fat line and a wide shot a hairline.
import React, {createContext, useContext} from "react";
import COMP from "./composition.json";
import {CharacterId} from "./types";

export const INK = "#2B2620";

/** lw: the outline in local units; ks: the factor for every other line width designed at the 6-unit outline. */
export type Ink = {lw: number; ks: number};
export const InkContext = createContext<Ink>({lw: 6, ks: 1});
export const useInk = () => useContext(InkContext);
/** The ink of a character drawn `px` screen px per local unit (its scale k, times any inset's scale). */
export const inkFor = (px: number): Ink => {
  const lw = COMP.outlinePx / Math.max(0.05, px);
  return {lw, ks: lw / 6};
};

export type BodySpec = {sh: number; w: number; waistY: number; waistW: number; hemY: number; hip: number; crotch: number;
  sole: number; legX: number; legW: number; skirt?: number[]};
export const BODIES = COMP.bodies as Record<CharacterId, BodySpec>;
export const bodyOf = (id: CharacterId): BodySpec => BODIES[id] ?? BODIES.father;

/** The top garment's silhouette: sloped shoulders, the chest, a slight waist, a hem over the hips. */
export const torsoPath = (B: BodySpec) => {
  const {sh, w, waistY, waistW, hemY} = B;
  const hw = Math.max(w, B.hip) + 4;
  return `M -40 -14 C -72 16 ${-(sh - 34)} 26 ${-(sh - 4)} 46 C ${-(sh + 10)} 58 ${-w} 96 ${-w} 140
    C ${-w} 182 ${-(waistW + 4)} ${waistY - 34} ${-waistW} ${waistY} C ${-(waistW - 2)} ${waistY + 14} ${-hw} ${hemY - 24}
    ${-hw} ${hemY - 8} Q ${-hw + 1} ${hemY + 4} ${-hw + 22} ${hemY + 6} Q 0 ${hemY + 16} ${hw - 22} ${hemY + 6}
    Q ${hw - 1} ${hemY + 4} ${hw} ${hemY - 8} C ${hw} ${hemY - 24} ${waistW - 2} ${waistY + 14} ${waistW} ${waistY}
    C ${waistW + 4} ${waistY - 34} ${w} 182 ${w} 140 C ${w} 96 ${sh + 10} 58 ${sh - 4} 46 C ${sh - 34} 26 72 16 40 -14 Z`;
};

/** The shoulder joint of an arm (side -1 = viewer's left). */
export const shoulderOf = (B: BodySpec, side: number): [number, number] => [side * (B.sh - 16), 74];

/** A soft floor shadow under the feet (drawn first; off screen in bust shots). */
export const FloorShadow: React.FC<{B: BodySpec; uid: string}> = ({B, uid}) => (
  <g>
    <defs>
      <radialGradient id={`${uid}-floor`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#000" stopOpacity={0.26} />
        <stop offset="70%" stopColor="#000" stopOpacity={0.12} />
        <stop offset="100%" stopColor="#000" stopOpacity={0} />
      </radialGradient>
    </defs>
    <ellipse cx={0} cy={B.sole - 4} rx={B.legX + B.legW + 70} ry={30} fill={`url(#${uid}-floor)`} />
  </g>
);

/**
 * Hips, two short rounded legs (trousers, or a skirt over bare legs), shoes or paws. One outline round the union:
 * every piece's outline first, then every fill.
 */
export const Legs: React.FC<{B: BodySpec; cloth: string; legFill: string; feet: "shoes" | "paws"; foot: string;
  back?: boolean}> = ({B, cloth, legFill, feet, foot, back}) => {
  const {lw, ks} = useInk();
  const ankle = B.sole - 30;
  const legTop = B.crotch - 60;
  const skirt = B.skirt;
  const legs = [-1, 1].map((s) => ({x: s * B.legX - B.legW, y: legTop, w: 2 * B.legW, h: ankle - legTop + 10,
    rx: B.legW * 0.92}));
  const hips = {x: -B.hip, y: B.waistY - 24, w: 2 * B.hip, h: B.crotch - B.waistY + 34, rx: 56};
  const pieces = skirt ? legs : [hips, ...legs];
  const legColor = skirt ? legFill : cloth;
  const footEl = (s: number) => {
    const cx = s * (B.legX + 8);
    const cy = B.sole - 28;
    if (feet === "paws") {
      return (
        <g key={s}>
          <ellipse cx={cx} cy={cy} rx={B.legW + 14} ry={30} fill={foot} stroke={INK} strokeWidth={lw} />
          {back ? null : <path d={`M ${cx - 13} ${cy + 6} v 20 M ${cx + 13} ${cy + 6} v 20`} stroke={INK}
            strokeWidth={3.5 * ks} strokeLinecap="round" />}
        </g>
      );
    }
    return (
      <g key={s}>
        <path d={`M ${cx - s * (B.legW + 6)} ${cy + 26} C ${cx - s * (B.legW + 12)} ${cy - 18} ${cx - s * 10} ${cy - 34}
          ${cx + s * 14} ${cy - 26} C ${cx + s * (B.legW + 22)} ${cy - 18} ${cx + s * (B.legW + 30)} ${cy + 12}
          ${cx + s * (B.legW + 24)} ${cy + 26} Z`} fill={foot} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
        <path d={`M ${cx - s * (B.legW + 4)} ${cy + 16} L ${cx + s * (B.legW + 24)} ${cy + 16}`} stroke={INK}
          strokeWidth={3 * ks} strokeLinecap="round" opacity={0.45} />
      </g>
    );
  };
  return (
    <g>
      {pieces.map((p, i) => <rect key={`o${i}`} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={INK}
        stroke={INK} strokeWidth={lw * 2} />)}
      {pieces.map((p, i) => <rect key={`f${i}`} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx}
        fill={i === 0 && !skirt ? cloth : legColor} />)}
      {/* the trousers' inner shadow between the legs */}
      {skirt ? null : <path d={`M 0 ${B.crotch - 40} L 0 ${B.crotch + 4}`} stroke={INK} strokeWidth={3.5 * ks}
        strokeLinecap="round" opacity={0.55} />}
      {[-1, 1].map(footEl)}
      {skirt ? (
        <path d={`M ${-(B.hip - 6)} ${B.waistY - 14} L ${B.hip - 6} ${B.waistY - 14} C ${B.hip + 6} ${B.waistY + 90}
          ${skirt[1]} ${skirt[0] - 70} ${skirt[1]} ${skirt[0] - 12} Q ${skirt[1] - 4} ${skirt[0] + 4} ${skirt[1] - 30}
          ${skirt[0] + 4} Q 0 ${skirt[0] + 16} ${-(skirt[1] - 30)} ${skirt[0] + 4} Q ${-(skirt[1] - 4)} ${skirt[0] + 4}
          ${-skirt[1]} ${skirt[0] - 12} C ${-skirt[1]} ${skirt[0] - 70} ${-(B.hip + 6)} ${B.waistY + 90}
          ${-(B.hip - 6)} ${B.waistY - 14} Z`} fill={cloth} stroke={INK} strokeWidth={lw} strokeLinejoin="round" />
      ) : null}
    </g>
  );
};

/** Trousers / skirt and shoe colours (no red: red means danger on this channel). */
export const LEG_LOOKS: Record<CharacterId, {cloth: string; shoe: string}> = {
  father: {cloth: "#5E5A52", shoe: "#3B302A"},
  mother: {cloth: "#5C4A5A", shoe: "#6B4A3A"},
  daughter: {cloth: "#3E4A5C", shoe: "#2F2A28"},
  son: {cloth: "#4A5E7A", shoe: "#F2F0EA"},
  scammer: {cloth: "#22252D", shoe: "#3A3F4B"},
  fake_banker: {cloth: "#3A3F4B", shoe: "#1E1B19"},
  ad: {cloth: "#34405A", shoe: "#1E1B19"},
};
