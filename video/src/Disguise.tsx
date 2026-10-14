// The fox's disguises (script cast "costume", composition.json "costumes"): the same rust fox comes back every episode,
// dressed for the scam of the day, and the disguise never quite hides him (the running gag): ears through the hat,
// a crooked fake moustache with the whiskers poking out, ears squashed out under a cap, an ear through a slick wig,
// the tail tip over the shoulder, his own ears and cheek fur round a cardboard mask of the son's face.
// Generic and invented: no logo, no uniform, no badge, no agency mark; muted grown-up colours, no red (danger).
// The readable part of every disguise sits at face / forehead / collar height: the aside and the twist close-up crop
// the head just under the title box and the body at the desk, so a hat's crown or a parcel alone would not change the
// first frame. Drawn in the animal rig's local units (Animal.tsx), a pure function of the pose.
import React from "react";
import {BodySpec, INK, useInk} from "./Body";
import {ArmSpec, Costume, Look, shade} from "./Character";
import type {Fur} from "./Animal";
import {CharacterId, CostumeId, Expression} from "./types";

type CostumeLook = {top?: string; inner?: string; accent?: string; legs?: {cloth: string; shoe: string}};

/** Clothes colours per disguise (over the character's own look, Character.tsx LOOKS). */
export const COSTUME_LOOKS: Record<CostumeId, CostumeLook> = {
  hoodie: {},
  bank_suit: {top: "#2E3A55", inner: "#F4F2EC", accent: "#3E6A72", legs: {cloth: "#2E3A55", shoe: "#1E1B19"}},
  investigator: {top: "#4E4436", inner: "#2F2B27", accent: "#2F2C29", legs: {cloth: "#2E2A26", shoe: "#1E1B19"}},
  courier: {top: "#6E7A86", inner: "#4A535C", accent: "#B8963A", legs: {cloth: "#3A4048", shoe: "#2F2A28"}},
  guru: {top: "#5B4E86", inner: "#F4F2EC", accent: "#E0B341", legs: {cloth: "#4A3F70", shoe: "#1E1B19"}},
  lecturer: {top: "#59636F", inner: "#E6DCC6", accent: "#3A3F4B", legs: {cloth: "#3A3F4B", shoe: "#2F2A28"}},
  family_mask: {},
};

export const lookOf = (L: Look, cos?: CostumeId): Look => (cos ? {...L, ...COSTUME_LOOKS[cos]} : L);
export const legsOf = (usual: {cloth: string; shoe: string}, cos?: CostumeId) => (cos && COSTUME_LOOKS[cos].legs) || usual;

/** The hood rolled down behind the neck (the hoodie, and under the mask); `usual` = the character wears its hood down
 * without a disguise (registry outfit darkHoodie: the scammer). */
export const hooded = (usual: boolean, cos?: CostumeId) => (cos ? cos === "hoodie" || cos === "family_mask" : usual);
/** The call centre's headset (the hoodie only); `usual` = the registry prop headset (the scammer). */
export const headset = (usual: boolean, cos?: CostumeId) => (cos ? cos === "hoodie" : usual);
/** The usual slicked forehead fur (registry hair "slicked": the suited foxes); a disguise brings its own hair or hat. */
export const slicked = (usual: boolean, cos?: CostumeId) => !cos && usual;

/** How the ears sit: as drawn, squashed out sideways under the courier's cap. */
export const earTransform = (cos: CostumeId | undefined, s: number) => (cos === "courier"
  ? `translate(${s * 104} -300) rotate(${s * 62}) scale(1 0.8) translate(${-s * 104} 300)` : undefined);

/** The mask comes off (slips aside) when he is caught (shocked; the acted panic of the fake son keeps it on). */
const unmasked = (e: Expression) => e === "shocked";

/** The arm that holds the mask's stick (family_mask, a resting right arm): the paw just under the chin. */
export const maskArm = (cos: CostumeId | undefined, e: Expression, R?: ArmSpec): ArmSpec | undefined =>
  cos === "family_mask" && !unmasked(e) && (!R || R.shape === "rest") ? {el: [214, 172], ha: [64, 58], shape: "fist"} : R;

/** Torso layer inside the torso's clip (front only): the outfit over the short torso. */
export const DisguiseTorso: React.FC<{cos: CostumeId; id: CharacterId; L: Look; B: BodySpec; back: boolean;
  uid: string}> = ({cos, id, L, B, back, uid}) => {
  const {lw, ks} = useInk();
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const};
  const thin = {stroke: INK, strokeWidth: 3.5 * ks, strokeLinecap: "round" as const, fill: "none"};
  const hw = Math.max(B.w, B.hip) + 4;
  if (back) return cos === "hoodie" || cos === "family_mask" ? <Costume id="scammer" L={L} B={B} back uid={uid} /> : null;
  switch (cos) {
    case "hoodie":
    case "family_mask":
      return <Costume id="scammer" L={L} B={B} back={false} uid={uid} />;
    case "bank_suit":
      // the suit, the tie and the blank staff card on its lanyard (no institution)
      return <Costume id="fake_banker" L={L} B={B} back={false} uid={uid} />;
    case "guru":
      return (
        <g>
          <Costume id="ad" L={L} B={B} back={false} uid={uid} />
          {/* the shiny suit */}
          <g stroke="#FFFFFF" strokeLinecap="round" fill="none">
            <path d={`M ${-B.w + 4} 120 L ${-B.w + 120} 46`} strokeWidth={14} opacity={0.34} />
            <path d={`M ${-B.w + 10} 186 L ${-B.w + 92} 136`} strokeWidth={7} opacity={0.28} />
            <path d={`M ${B.w - 90} 60 L ${B.w - 10} 34`} strokeWidth={9} opacity={0.24} />
          </g>
        </g>
      );
    case "investigator":
      return (
        <g>
          {/* a dark shirt in a narrow V, the trench coat's wide lapels, two rows of buttons, the belt */}
          <path d="M -46 -14 L 46 -14 L 0 120 Z" fill={L.inner} {...st} />
          {[-1, 1].map((s) => (
            <path key={s} d={`M ${s * 48} -14 L ${s * 150} 66 L ${s * 112} 92 L ${s * 46} 196 L 0 120 Z`}
              fill={shade(L.top, -0.1)} {...st} />
          ))}
          {[[-58, 168], [58, 168], [-58, 214], [58, 214]].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={9} fill={shade(L.top, 0.35)} stroke={INK} strokeWidth={3 * ks} />
          ))}
          <rect x={-hw} y={B.waistY - 12} width={2 * hw} height={28} fill={shade(L.top, 0.28)} />
          <rect x={-22} y={B.waistY - 16} width={44} height={36} rx={6} fill="none" stroke="#9C8E72" strokeWidth={6 * ks} />
        </g>
      );
    case "courier":
      return (
        <g>
          {/* the work vest over a grey shirt: grey reflective bands, a blank chest patch, the zip */}
          <path d={`M ${-hw - 10} 70 Q -120 16 -60 -12 L -22 104 L 22 104 L 60 -12 Q 120 16 ${hw + 10} 70
            L ${hw + 10} ${B.hemY + 30} L ${-hw - 10} ${B.hemY + 30} Z`} fill={L.accent} {...st} />
          {[150, 204].map((y) => (
            <g key={y}>
              <rect x={-hw} y={y} width={hw - 10} height={20} fill="#D9DDE2" opacity={0.92} />
              <rect x={10} y={y} width={hw} height={20} fill="#D9DDE2" opacity={0.92} />
            </g>
          ))}
          <path d={`M 0 104 V ${B.hemY + 20}`} {...thin} />
          <rect x={42} y={50} width={62} height={34} rx={8} fill="#E8DFC8" stroke={INK} strokeWidth={3 * ks} />
        </g>
      );
    case "lecturer":
      return (
        <g>
          {/* the blazer open over a turtleneck (the roll is drawn at the neck, DisguiseNeck) */}
          <path d="M -66 -14 L 66 -14 L 44 330 L -44 330 Z" fill={L.inner} {...st} />
          {[90, 140, 190].map((y) => <path key={y} d={`M -40 ${y} q 40 6 80 0`} {...thin} opacity={0.3} />)}
          {[-1, 1].map((s) => (
            <path key={s} d={`M ${s * 66} -14 L ${s * 112} 80 L ${s * 88} 100 L ${s * 46} 330`} fill="none" {...st} />
          ))}
          <path d="M 96 120 l 44 -6 l 4 16 l -44 6 Z" fill="#F4F2EC" stroke={INK} strokeWidth={3 * ks} />
        </g>
      );
    default:
      return null;
  }
};

/** The turtleneck's roll at the neck (lecturer), drawn over the neck and under the head. */
export const DisguiseNeck: React.FC<{cos?: CostumeId; L: Look; back: boolean}> = ({cos, L, back}) => {
  const {lw, ks} = useInk();
  if (cos !== "lecturer" || back) return null;
  return (
    <g>
      <rect x={-74} y={-56} width={148} height={78} rx={30} fill={L.inner} stroke={INK} strokeWidth={lw} />
      {[-40, -14, 12, 38].map((x) => <path key={x} d={`M ${x} -46 v 56`} stroke={shade(L.inner, 0.18)}
        strokeWidth={4 * ks} strokeLinecap="round" />)}
    </g>
  );
};

/** Behind the body: the lecturer's tail tip peeking up over the viewer's left shoulder (the leak). */
export const DisguiseBehind: React.FC<{cos?: CostumeId; F: Fur; back: boolean}> = ({cos, F, back}) => {
  const {lw} = useInk();
  if (cos !== "lecturer" || back) return null;
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const};
  return (
    <g>
      <path d="M -60 280 C -230 250 -300 110 -270 -30 C -262 -86 -222 -118 -190 -104 C -214 -40 -196 70 -110 160 Z"
        fill={F.fur} {...st} />
      <path d="M -270 -30 C -262 -86 -222 -118 -190 -104 C -200 -78 -204 -50 -200 -20 C -230 -16 -254 -20 -270 -30 Z"
        fill={F.mask} {...st} />
    </g>
  );
};

/** Beside the body, over the torso and under the arms: the folder, the parcel, the laptop tucked under the left arm. */
export const DisguiseSide: React.FC<{cos?: CostumeId; back: boolean}> = ({cos, back}) => {
  const {lw, ks} = useInk();
  if (back) return null;
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const};
  switch (cos) {
    case "investigator":
      // a plain folder (no seal, no agency name)
      return (
        <g transform="translate(-206 168) rotate(-10)">
          <path d="M -62 -84 h 46 l 10 -14 h 40 l 10 14 h 18 v 168 h -124 Z" fill="#D6C496" {...st} />
          <path d="M -50 -40 h 86 M -50 -14 h 70" stroke="#A8966A" strokeWidth={5 * ks} strokeLinecap="round" />
        </g>
      );
    case "courier":
      // a taped parcel with a blank label
      return (
        <g transform="translate(-214 176) rotate(-6)">
          <rect x={-80} y={-62} width={160} height={124} rx={6} fill="#C49A6C" {...st} />
          <path d="M -80 -30 H 80" stroke={INK} strokeWidth={3.5 * ks} opacity={0.5} />
          <rect x={-14} y={-62} width={28} height={124} fill="#E6D3A8" opacity={0.85} />
          <rect x={22} y={4} width={46} height={32} rx={4} fill="#F4F0E6" stroke={INK} strokeWidth={3 * ks} />
        </g>
      );
    case "lecturer":
      // a closed laptop, no logo
      return (
        <g transform="translate(-212 170) rotate(-12)">
          <rect x={-74} y={-96} width={148} height={192} rx={12} fill="#A3ABB4" {...st} />
          <rect x={-74} y={-96} width={148} height={192} rx={12} fill="none" stroke="#FFFFFF" strokeWidth={4 * ks}
            opacity={0.35} transform="translate(5 5) scale(0.93)" />
        </g>
      );
    default:
      return null;
  }
};

/** The guru's pointer in the right paw, along the forearm (drawn under the paw). */
export const Pointer: React.FC<{from: [number, number]; at: [number, number]}> = ({from, at}) => {
  const {lw} = useInk();
  const dx = at[0] - from[0];
  const dy = at[1] - from[1];
  const n = Math.max(1, Math.hypot(dx, dy));
  const end: [number, number] = [at[0] + (dx / n) * 230, at[1] + (dy / n) * 230];
  const d = `M ${at[0]} ${at[1]} L ${end[0]} ${end[1]}`;
  return (
    <g>
      <path d={d} stroke={INK} strokeWidth={10 + lw * 2} strokeLinecap="round" />
      <path d={d} stroke="#D8D2C6" strokeWidth={10} strokeLinecap="round" />
      <circle cx={end[0]} cy={end[1]} r={13} fill="#E0B341" stroke={INK} strokeWidth={lw} />
    </g>
  );
};

/**
 * Head layer over the face (after the eyes, brows and snout): hats, wigs, glasses, the moustache, the mic, the collar,
 * the mask. `ear(s)` draws one of the fox's own ears (outline, inner, tip), for the ears that poke through.
 */
export const DisguiseHead: React.FC<{cos?: CostumeId; L: Look; F: Fur; e: Expression; dx: number; back: boolean;
  uid: string; earDx: number; talking: boolean; mouth: number; ear: (s: number) => React.ReactNode}> = ({cos, L, F, e,
  dx, back, uid, earDx, talking, mouth, ear}) => {
  const {lw, ks} = useInk();
  if (!cos || cos === "hoodie") return null;
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const};
  const hx = dx * 0.5;
  const fx = dx * 1.15;
  /** The fox's own ears (side `sides`) drawn again above `y`, in front of a hat or a wig, from a dark hole. */
  const through = (y: number, sides: number[], crown: string) => (
    <g>
      <defs>
        <clipPath id={`${uid}-thru`}><rect x={-320} y={-520} width={640} height={520 + y} /></clipPath>
        <clipPath id={`${uid}-crown`}><path d={crown} /></clipPath>
      </defs>
      {/* the torn holes, only where the ear leaves the hat / the wig */}
      <g transform={`translate(${hx} 0)`} clipPath={`url(#${uid}-crown)`}>
        {sides.map((s) => <ellipse key={`h${s}`} cx={s * 108 + earDx - hx} cy={y + 4} rx={54} ry={11} fill="#1A1614" />)}
      </g>
      <g clipPath={`url(#${uid}-thru)`} transform={`translate(${earDx} 0)`}>{sides.map((s) => <g key={s}>{ear(s)}</g>)}</g>
    </g>
  );
  if (back) {
    // from behind only the hats and the hair show
    switch (cos) {
      case "investigator": return <path d="M -196 -306 C -196 -334 196 -334 196 -306 C 196 -278 -196 -278 -196 -306 Z" fill="#2F2C29" {...st} />;
      case "courier": return <path d="M -150 -296 C -156 -390 -70 -404 0 -404 C 70 -404 156 -390 150 -296 Z" fill={L.accent} {...st} />;
      default: return null;
    }
  }
  switch (cos) {
    case "bank_suit":
      return (
        <g>
          {/* a neat side-part hairpiece, a little askew */}
          <g transform={`translate(${hx} 0) rotate(-5 0 -330)`}>
            <path d="M -132 -290 C -138 -356 -64 -380 4 -380 C 74 -380 138 -356 132 -292 C 100 -318 44 -330 -14 -322
              L -34 -298 L -48 -322 C -84 -318 -112 -306 -132 -290 Z" fill="#2A2420" {...st} />
            <path d="M 20 -360 C 60 -360 96 -348 112 -330" stroke="#6A5A4E" strokeWidth={6 * ks} fill="none"
              strokeLinecap="round" />
          </g>
          {/* thin office glasses */}
          <g transform={`translate(${dx} 0)`}>
            {[-1, 1].map((s) => <rect key={s} x={s * 62 - 46} y={-228} width={92} height={76} rx={16}
              fill="rgba(220,236,245,0.14)" stroke={INK} strokeWidth={5.5 * ks} />)}
            <path d="M -16 -198 Q 0 -208 16 -198" stroke={INK} strokeWidth={5 * ks} fill="none" />
            <path d="M -108 -204 L -152 -214 M 108 -204 L 152 -214" stroke={INK} strokeWidth={4.5 * ks} />
          </g>
          {/* the fake moustache, crooked, the whiskers poking out from under it (the leak) */}
          <g transform={`translate(${fx + 8} -113) rotate(-9) scale(0.86)`}>
            {[-1, 1].map((s) => (
              <path key={s} d={`M ${s * 62} -4 L ${s * 116} -14 M ${s * 62} 6 L ${s * 118} 10`}
                stroke="#4E3E34" strokeWidth={3.5 * ks} strokeLinecap="round" />
            ))}
            <path d="M -70 6 C -64 -14 -32 -20 -6 -8 C 0 -13 6 -13 10 -8 C 36 -20 68 -14 74 6 C 52 0 30 12 4 5
              C -24 14 -50 2 -70 6 Z" fill="#2A2420" stroke={INK} strokeWidth={4 * ks} strokeLinejoin="round" />
          </g>
        </g>
      );
    case "investigator":
      return (
        <g>
          {/* the trench coat's collar turned up beside the jaw */}
          {[-1, 1].map((s) => (
            <path key={`c${s}`} d={`M ${s * 34} 22 L ${s * 160} 44 L ${s * 198} -60 L ${s * 108} -38 Z`}
              fill={shade(L.top, -0.08)} {...st} />
          ))}
          {/* a plain brimmed hat pulled low; the ears poke through two holes in the crown (the leak) */}
          <g transform={`translate(${hx} 0)`}>
            <path d="M -198 -304 C -198 -334 198 -334 198 -304 C 198 -276 -198 -276 -198 -304 Z" fill="#2F2C29" {...st} />
            <path d="M -124 -312 C -134 -372 -114 -404 -60 -404 Q 0 -388 60 -404 C 114 -404 134 -372 124 -312 Z"
              fill="#34302C" {...st} />
            <path d="M -126 -334 C -60 -344 60 -344 126 -334 L 124 -314 C 60 -324 -60 -324 -124 -314 Z" fill="#5A4E40" />
          </g>
          {through(-340, [-1, 1], "M -124 -312 C -134 -372 -114 -404 -60 -404 Q 0 -388 60 -404 C 114 -404 134 -372 124 -312 Z")}
        </g>
      );
    case "courier":
      return (
        <g transform={`translate(${hx} 0)`}>
          {/* a plain cap, a blank patch (no logo); the ears squashed out under it (Animal.tsx earTransform) */}
          <path d="M -152 -294 C -158 -392 -70 -408 0 -408 C 70 -408 158 -392 152 -294 Z" fill={L.accent} {...st} />
          <path d="M 0 -406 V -300" stroke={INK} strokeWidth={3.5 * ks} opacity={0.45} />
          <rect x={-46} y={-380} width={92} height={50} rx={12} fill="#E8DFC8" stroke={INK} strokeWidth={3.5 * ks} />
          <path d="M -160 -298 C -100 -324 100 -324 160 -298 C 146 -262 -146 -262 -160 -298 Z" fill={shade(L.accent, 0.22)}
            {...st} />
          <circle cx={0} cy={-408} r={10} fill={shade(L.accent, 0.22)} stroke={INK} strokeWidth={3.5 * ks} />
        </g>
      );
    case "guru":
      return (
        <g>
          {/* a slick wig; the right ear is a lump under it, the left one pokes through (the leak) */}
          <g transform={`translate(${hx} 0)`}>
            <path d="M -150 -286 C -172 -362 -126 -424 -24 -428 C 84 -432 156 -404 184 -350 C 206 -306 196 -262 168 -246
              C 156 -282 120 -316 40 -330 C -30 -340 -100 -320 -150 -286 Z" fill="#D6B45E" {...st} />
            <path d="M -96 -372 C -40 -410 50 -412 112 -384" stroke="#FFFFFF" strokeWidth={9} fill="none"
              strokeLinecap="round" opacity={0.5} />
            <path d="M -60 -344 C -10 -368 50 -366 96 -348" stroke="#FFFFFF" strokeWidth={6} fill="none"
              strokeLinecap="round" opacity={0.35} />
          </g>
          {through(-356, [-1], "M -150 -286 C -172 -362 -126 -424 -24 -428 C 84 -432 156 -404 184 -350 C 206 -306 196 -262 168 -246 C 156 -282 120 -316 40 -330 C -30 -340 -100 -320 -150 -286 Z")}
          <path transform="translate(-196 -404) scale(0.9)" d="M 0 -30 Q 5 -5 30 0 Q 5 5 0 30 Q -5 5 -30 0 Q -5 -5 0 -30 Z"
            fill="#FFE9A8" stroke={INK} strokeWidth={4 * ks} strokeLinejoin="round" />
        </g>
      );
    case "lecturer":
      return (
        <g>
          {/* round glasses */}
          <g transform={`translate(${dx} 0)`}>
            {[-1, 1].map((s) => <circle key={s} cx={s * 62} cy={-190} r={42} fill="rgba(220,236,245,0.12)" stroke="#5A4030"
              strokeWidth={8 * ks} />)}
            <path d="M -20 -198 Q 0 -210 20 -198" stroke="#5A4030" strokeWidth={7 * ks} fill="none" />
            <path d="M -104 -196 L -150 -208 M 104 -196 L 150 -208" stroke="#5A4030" strokeWidth={6 * ks} />
          </g>
          {/* a thin cheek mic from the ear (not the call centre's headset) */}
          <path d={`M -156 -244 Q -170 -226 -152 -212 C -140 -150 -110 -112 ${-70 + fx} -104`} stroke={INK}
            strokeWidth={9 * ks} fill="none" strokeLinecap="round" />
          <path d={`M -156 -244 Q -170 -226 -152 -212 C -140 -150 -110 -112 ${-70 + fx} -104`} stroke="#C9CDD2"
            strokeWidth={4.5 * ks} fill="none" strokeLinecap="round" />
          <ellipse cx={-62 + fx} cy={-103} rx={12} ry={9} fill="#2A2D36" stroke={INK} strokeWidth={3.5 * ks} />
        </g>
      );
    case "family_mask": {
      // a cardboard mask of the son's face on a stick; the fox's own ears and cheek fur stick out round it (the leak).
      // Caught, it slips aside.
      const off = unmasked(e);
      const bob = talking ? -mouth * 1.6 : 0;
      const tf = off ? "translate(-150 150) rotate(-34 0 -60)" : `translate(${dx * 1.1} ${bob})`;
      return (
        <g transform={tf}>
          <path d="M 4 -70 L 54 52" stroke={INK} strokeWidth={14 + lw * 2} strokeLinecap="round" />
          <path d="M 4 -70 L 54 52" stroke="#B08A5A" strokeWidth={14} strokeLinecap="round" />
          {/* the cut-out ears and the face card */}
          {[-1, 1].map((s) => <path key={s} d={`M ${s * 56} -296 L ${s * 108} -372 L ${s * 126} -276 Z`} fill="#E7D8BE"
            {...st} />)}
          <ellipse cx={0} cy={-196} rx={136} ry={132} fill="#E7D8BE" {...st} />
          <path d="M -34 -322 Q -22 -360 -2 -342 Q 8 -368 30 -326" fill="#E7D8BE" {...st} />
          {/* cardboard: a few crayon strokes and a torn corner */}
          <path d="M -110 -120 l 30 -8 M -96 -100 l 26 -6 M 84 -262 l 26 8" stroke="#B89A6C" strokeWidth={4 * ks}
            strokeLinecap="round" />
          <path d="M 120 -150 l 18 4 l -6 18 Z" fill="#C9B48C" stroke={INK} strokeWidth={3 * ks} />
          {/* the son's drawn face: round eyes, a dog's nose, a big smile */}
          {[-1, 1].map((s) => (
            <g key={s}>
              <circle cx={s * 54} cy={-196} r={18} fill={INK} />
              <circle cx={s * 54 - 6} cy={-202} r={6} fill="#FFFFFF" />
              <path d={`M ${s * 34} -238 q ${s * 20} -10 ${s * 40} 0`} stroke={INK} strokeWidth={7 * ks} fill="none"
                strokeLinecap="round" />
              <ellipse cx={s * 92} cy={-140} rx={20} ry={11} fill="#E39A86" opacity={0.45} />
            </g>
          ))}
          <ellipse cx={0} cy={-150} rx={26} ry={18} fill="#2E2622" />
          <path d="M -58 -118 Q 0 -66 58 -118" stroke={INK} strokeWidth={7 * ks} fill="none" strokeLinecap="round" />
        </g>
      );
    }
    default:
      return null;
  }
};

/** Whether the disguise hides one of the fox's ears under a wig (the guru's right ear). */
export const earHidden = (cos: CostumeId | undefined, s: number) => cos === "guru" && s === 1;
