// Species templates of the animal skin (composition.json "species"; the registry's `species`): the head, the ears,
// the face markings and the tail of each species, plus the generic clothes, hats, hair, glasses and props a registry
// character (content/characters) can wear. Same ink and rules as Animal.tsx: the fixed on-screen #2B2620 outline
// (InkContext), flat fills plus one shadow tone, everything inside the rig's head box (composition.json
// animal.speciesBox, tests/test_character_registry.py) with the eyes on rig.eyeY and the mouth on rig.mouthY, so every
// staging and every expression / mouth shape / blink of Animal.tsx works for every species.
// Our own designs, drawn only in code, muted grown-up palettes: a 진돗개 (dog) and a 여우 (fox) as before; a cat with
// whisker pads and a tabby forehead; a lop-eared rabbit (ears hanging beside the face, not upright cartoon ears); a
// 반달가슴곰 (Asiatic black bear: charcoal fur, a pale crescent under the chin, a tapered muzzle and the cast's big
// white eyes, never a flat round button face); a 너구리 (raccoon dog: grey-taupe fur, dark eye patches, a pale muzzle,
// fluffy cheeks, dark round ears). The hedgehog is 도치's only (Mascot.tsx).
import React from "react";
import COMP from "./composition.json";
import {BodySpec, INK, useInk} from "./Body";
import {Cloud, Look, P, shade} from "./Character";
import {RIG} from "./rig";
import {CharacterSpec, Species} from "./types";

const A = COMP.animal;
const T = A.earTip;
const W = A.halfWidth;

/* ------------------------------------------------------------------ heads */

/** A superellipse head: `nTop`/`nBot` squareness above/below the centre, `pinch` narrows the lower half (the fox's
 * tapering muzzle). */
const headPath = (cy: number, top: number, bottom: number, nTop: number, nBot: number, pinch: number, half = 158) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const lower = s > 0;
    const n = lower ? nBot : nTop;
    let x = half * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = cy + (lower ? bottom - cy : cy - top) * Math.sign(s) * Math.abs(s) ** (2 / n);
    if (lower) x *= 1 - pinch * s ** 1.6;
    pts.push([x, y]);
  }
  return P(pts);
};

export const HEADS: Record<Species, string> = {
  dog: headPath(-200, A.skullTop, A.jowl, 2.3, 2.75, 0.05),
  fox: headPath(-204, A.skullTop + 4, A.jowl + 2, 2.4, 1.8, 0.4),
  cat: headPath(-200, A.skullTop + 8, A.speciesBox.cat.jowl, 2.2, 2.3, 0.1, 160),
  rabbit: headPath(-206, A.skullTop + 2, A.speciesBox.rabbit.jowl, 2.1, 2.2, 0.1, 154),
  bear: headPath(-198, A.skullTop + 12, A.speciesBox.bear.jowl, 2.45, 2.6, 0.03, 162),
  raccoon: headPath(-202, A.skullTop + 8, A.speciesBox.raccoon.jowl, 2.3, 2.0, 0.2),
};

/* ------------------------------------------------------------------ ears */

const circle = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

/** An ear (side s = -1 viewer's left, 1 right): its outline or (`inner`) the pale inner fur. */
export const earPath = (sp: Species, s: number, inner: boolean) => {
  switch (sp) {
    case "dog":
      return inner
        ? `M ${s * 70} -306 C ${s * 82} -346 ${s * 102} -384 ${s * 118} -392 C ${s * 132} -386 ${s * 140} -340 ${s * 140} -288 Z`
        : `M ${s * 40} -312 C ${s * 58} -360 ${s * 90} ${T + 14} ${s * 106} ${T + 3} Q ${s * 122} ${T - 4} ${s * 134} ${T + 8}
          C ${s * 154} -350 ${s * 164} -320 ${s * 162} -262 Z`;
    case "fox":
      return inner
        ? `M ${s * 62} -300 C ${s * 80} -344 ${s * 112} -384 ${s * 132} -390 C ${s * 148} -380 ${s * 156} -330 ${s * 154} -268 Z`
        : `M ${s * 28} -306 C ${s * 54} -364 ${s * 110} ${T + 2} ${s * 134} ${T} C ${s * 164} ${T + 4} ${s * 182} -330 ${s * 176} -238 Z`;
    case "cat":
      // wide-based triangles set apart, a slightly rounded tip turned outward
      return inner
        ? `M ${s * 78} -300 C ${s * 96} -338 ${s * 118} -374 ${s * 136} -386 C ${s * 146} -366 ${s * 150} -326 ${s * 148} -290 Z`
        : `M ${s * 46} -316 C ${s * 72} -352 ${s * 112} -392 ${s * 136} -404 Q ${s * 148} -410 ${s * 152} -396
          C ${s * 166} -352 ${s * 172} -310 ${s * 166} -256 Z`;
    case "rabbit":
      // a lop ear: from the crown over the side of the head, hanging down beside the cheek (drawn over the head)
      return inner
        ? `M ${s * 146} -284 C ${s * 172} -240 ${s * 178} -160 ${s * 166} -114 C ${s * 150} -114 ${s * 144} -170 ${s * 142} -230 Z`
        : `M ${s * 26} -334 C ${s * 70} -392 ${s * 150} -380 ${s * 176} -304 C ${s * 194} -236 ${s * 192} -150 ${s * 178} -108
          C ${s * 166} -76 ${s * 130} -80 ${s * 126} -118 C ${s * 120} -190 ${s * 118} -268 ${s * 86} -312 Z`;
    case "bear":
      return inner ? circle(s * 124, -326, 25) : circle(s * 126, -330, 46);
    case "raccoon":
      // small rounded ears with a dark back (darkEars) and a pale inside
      return inner
        ? `M ${s * 82} -308 C ${s * 92} -342 ${s * 110} -364 ${s * 124} -366 C ${s * 140} -360 ${s * 144} -330 ${s * 140} -296 Z`
        : `M ${s * 56} -316 C ${s * 70} -360 ${s * 100} -390 ${s * 124} -392 C ${s * 152} -390 ${s * 166} -346 ${s * 158} -284 Z`;
  }
};

/** Species whose ears hang over the head (drawn after the face, under the eyes' layer). */
export const earsOverHead = (sp: Species) => sp === "rabbit";
/** Species whose outer ear is the dark marking colour (the raccoon dog's black-backed ears). */
export const darkEars = (sp: Species) => sp === "raccoon";

/* ------------------------------------------------------------------ cheek fur (behind the face outline) */

export const cheekPath = (sp: Species, s: number): string | null => {
  switch (sp) {
    case "fox":
      return `M ${s * 118} -186 Q ${s * 150} -160 ${s * (W - 18)} -142 Q ${s * 158} -132 ${s * 146}
  -122 Q ${s * 166} -110 ${s * (W - 26)} -96 Q ${s * 132} -92 ${s * 100} -98 Z`;
    case "cat":
      return `M ${s * 128} -176 Q ${s * 166} -156 ${s * 182} -132 Q ${s * 160} -128 ${s * 152} -116 Q ${s * 170} -102
        ${s * 164} -86 Q ${s * 136} -86 ${s * 112} -98 Z`;
    case "raccoon":
      return `M ${s * 116} -196 Q ${s * 164} -182 ${s * 186} -156 Q ${s * 164} -148 ${s * 160} -136 Q ${s * 186} -122
        ${s * 180} -100 Q ${s * 154} -102 ${s * 148} -88 Q ${s * 130} -84 ${s * 104} -96 Z`;
    default:
      return null;
  }
};

/* ------------------------------------------------------------------ faces (inside the head's clip) */

/** The fox's cream mask: lower cheeks and chin, with the rust bridge of the nose running down the middle. */
export const FOX_MASK = "M -190 -168 C -132 -176 -84 -160 -52 -134 C -34 -120 -22 -146 0 -150 C 22 -146 34 -120 52 -134 C 84 -160 132 -176 190 -168 L 190 0 L -190 0 Z";

/** The Jindo muzzle: a pale snout from between the eyes down to the chin, wider at the mouth (a dog's long muzzle
 * seen from the front, not a bear's round button). */
export const MUZZLE = `M -30 ${A.muzzle.top} C -34 -150 -72 -138 -92 -116 C -${A.muzzle.halfWidth + 8} -96 -${A.muzzle.halfWidth} -50 -70 -40
  C -40 ${A.muzzle.bottom + 4} 40 ${A.muzzle.bottom + 4} 70 -40 C ${A.muzzle.halfWidth} -50 ${A.muzzle.halfWidth + 8} -96 92 -116
  C 72 -138 34 -150 30 ${A.muzzle.top} Q 0 ${A.muzzle.top - 8} -30 ${A.muzzle.top} Z`;

/** The bear's muzzle: tapered from a bridge between the eyes, rounded at the mouth (no flat oval button). */
const BEAR_MUZZLE = "M -24 -186 C -28 -160 -56 -150 -74 -132 C -94 -110 -92 -66 -64 -52 C -36 -38 36 -38 64 -52 C 92 -66 94 -110 74 -132 C 56 -150 28 -160 24 -186 Q 0 -194 -24 -186 Z";
/** The raccoon dog's pale muzzle, shorter than the Jindo's. */
const RACCOON_MUZZLE = "M -22 -168 C -26 -150 -58 -136 -76 -116 C -96 -92 -90 -56 -60 -44 C -30 -32 30 -32 60 -44 C 90 -56 96 -92 76 -116 C 58 -136 26 -150 22 -168 Q 0 -174 -22 -168 Z";
/** The raccoon dog's dark patch round one eye, running down and out over the cheek. */
const eyePatch = (s: number) => `M ${s * 14} -206 C ${s * 16} -246 ${s * 98} -258 ${s * 124} -218 C ${s * 142} -186
  ${s * 134} -136 ${s * 104} -122 C ${s * 76} -110 ${s * 50} -132 ${s * 34} -152 C ${s * 18} -170 ${s * 12} -188 ${s * 14} -206 Z`;

/**
 * The species' face markings in the head's clip (front view), drawn over the fur's shadow tone: the fox mask, the
 * Jindo muzzle (+ the pale urajiro brow spots), the cat's whisker pads, chin and tabby stripes, the rabbit's pads,
 * the bear's muzzle, the raccoon dog's eye patches, muzzle and pale brows. `dx` = the face's turn offset.
 */
export const FaceMarkings: React.FC<{sp: Species; S: CharacterSpec; dx: number}> = ({sp, S, dx}) => {
  const {ks} = useInk();
  const C = S.palette;
  const mark = C.marking ?? shade(C.fur, 0.3);
  switch (sp) {
    case "fox":
      return <path d={FOX_MASK} fill={C.muzzle} transform={`translate(${dx * 1.1} 0)`} />;
    case "dog":
      return (
        <g>
          <path d={MUZZLE} transform={`translate(${dx * 1.15} 0)`} fill={C.muzzle} stroke={shade(C.fur, 0.2)}
            strokeWidth={4.5 * ks} />
          {S.markings === "urajiro" ? [-1, 1].map((s) => (
            // the pale "eyebrow" patches of a Jindo / 누렁이 (urajiro), above each eye
            <ellipse key={s} cx={s * 64 + dx} cy={-250} rx={18} ry={10} fill={C.muzzle} opacity={0.65} />
          )) : null}
        </g>
      );
    case "cat":
    case "rabbit": {
      const fx = dx * 1.15;
      return (
        <g>
          {S.markings === "tabby" ? (
            // the tabby's forehead stripes and two cheek stripes a side
            <g stroke={mark} strokeWidth={13} strokeLinecap="round" fill="none" opacity={0.85}>
              <path d={`M ${dx * 0.6 - 34} -340 l 6 40 M ${dx * 0.6} -348 v 46 M ${dx * 0.6 + 34} -340 l -6 40`} />
              {[-1, 1].map((s) => <path key={s} d={`M ${s * 162} -214 l ${-s * 30} 6 M ${s * 164} -188 l ${-s * 26} 8`} />)}
            </g>
          ) : null}
          {/* the chin, then the two whisker pads under the nose */}
          <ellipse cx={fx} cy={-60} rx={sp === "cat" ? 42 : 36} ry={22} fill={C.muzzle} />
          {[-1, 1].map((s) => (
            <ellipse key={s} cx={fx + s * 30} cy={-110} rx={sp === "cat" ? 38 : 34} ry={27} fill={C.muzzle}
              stroke={shade(C.fur, 0.2)} strokeWidth={4 * ks} />
          ))}
          {[-1, 1].map((s) => [0, 1, 2].map((i) => (
            <circle key={`${s}${i}`} cx={fx + s * (22 + i * 13)} cy={-112 + (i % 2) * 9} r={3.2} fill={shade(C.fur, 0.35)} />
          )))}
        </g>
      );
    }
    case "bear":
      return (
        <path d={BEAR_MUZZLE} transform={`translate(${dx * 1.15} 0)`} fill={C.muzzle} stroke={shade(C.muzzle, 0.25)}
          strokeWidth={4.5 * ks} />
      );
    case "raccoon":
      return (
        <g>
          {[-1, 1].map((s) => <path key={s} d={eyePatch(s)} fill={mark} transform={`translate(${dx} 0)`} />)}
          <path d={RACCOON_MUZZLE} transform={`translate(${dx * 1.15} 0)`} fill={C.muzzle} stroke={shade(C.fur, 0.2)}
            strokeWidth={4.5 * ks} />
          {[-1, 1].map((s) => <ellipse key={s} cx={s * 66 + dx} cy={-262} rx={26} ry={11} fill={C.muzzle} opacity={0.9} />)}
        </g>
      );
  }
};

/** Over the face (after the eyes): the cat's and the rabbit's whiskers, three thin lines a side from the pads. */
export const Whiskers: React.FC<{sp: Species; dx: number}> = ({sp, dx}) => {
  const {ks} = useInk();
  if (sp !== "cat" && sp !== "rabbit") return null;
  const fx = dx * 1.15;
  const reach = sp === "cat" ? 1 : 0.82;
  return (
    <g stroke={INK} strokeWidth={3.5 * ks} strokeLinecap="round" fill="none" opacity={0.8}>
      {[-1, 1].map((s) => (
        <path key={s} d={`M ${fx + s * 64} -122 L ${fx + s * (64 + 110 * reach)} ${-138}
          M ${fx + s * 68} -108 L ${fx + s * (68 + 112 * reach)} -106 M ${fx + s * 64} -94 L ${fx + s * (64 + 104 * reach)} -78`} />
      ))}
    </g>
  );
};

/** Nose size and height, the shocked mouth's half width, whether the resting mouth is the ω, brows. */
export const NOSE: Record<Species, {y: number; w: number; h: number}> = {
  dog: {y: A.nose, w: 34, h: 28},
  fox: {y: A.nose + 8, w: 19, h: 19},
  cat: {y: A.nose + 6, w: 17, h: 13},
  rabbit: {y: A.nose + 6, w: 15, h: 12},
  bear: {y: A.nose - 2, w: 36, h: 26},
  raccoon: {y: A.nose + 2, w: 28, h: 22},
};
/** The resting ω of a dog-like snout (the fox keeps a plain line). */
export const omegaRest = (sp: Species) => sp !== "fox";
/** Brows: [inner x, outer x, width] (the fox's are thin and set wider). */
export const browGeom = (sp: Species): [number, number, number] => (sp === "fox" ? [32, 94, 9] : [38, 88, 12]);
/** A touch of warmth on the cheeks (not on the foxes, nor on the dark bear). */
export const blush = (sp: Species) => sp !== "fox" && sp !== "bear";

/** The bear's pale crescent (반달) under the chin, on the neck above the collar. */
export const Crescent: React.FC<{S: CharacterSpec}> = ({S}) => S.species === "bear" ? (
  <path d="M -42 -46 Q 0 -6 42 -46 L 44 -26 Q 0 14 -44 -26 Z" fill={S.palette.marking ?? S.palette.muzzle} />
) : null;

/* ------------------------------------------------------------------ tails (full figures only) */

/** The tail behind the legs (pose.tail: the lineups where the feet show): the fox's brush as before, the cat's long
 * curl, the rabbit's puff, the bear's stub, the raccoon dog's bushy tail with a dark tip. The dog keeps none. */
export const Tail: React.FC<{S: CharacterSpec; B: BodySpec; back: boolean}> = ({S, B, back}) => {
  const {lw} = useInk();
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const};
  const C = S.palette;
  const at = `translate(${-B.hip + 20} ${B.crotch - 10}) rotate(${back ? 10 : -6})`;
  switch (S.species) {
    case "fox":
      return (
        <g transform={at}>
          <path d="M 20 -30 C -60 -40 -150 10 -170 110 C -176 150 -150 176 -120 160 C -96 120 -40 60 30 30 Z"
            fill={C.fur} {...st} />
          <path d="M -170 110 C -176 150 -150 176 -120 160 C -120 140 -128 120 -150 96 Z" fill={C.muzzle} {...st} />
        </g>
      );
    case "cat": {
      const d = "M 10 0 C -70 10 -150 -10 -150 -120 C -150 -160 -126 -176 -110 -168";
      return (
        <g transform={at}>
          <path d={d} stroke={INK} strokeWidth={34 + lw * 2} fill="none" strokeLinecap="round" />
          <path d={d} stroke={C.fur} strokeWidth={34} fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case "rabbit":
      return <circle cx={-B.hip + 26} cy={B.crotch - 40} r={36} fill={C.muzzle} {...st} />;
    case "bear":
      return <circle cx={-B.hip + 30} cy={B.crotch - 40} r={26} fill={C.fur} {...st} />;
    case "raccoon":
      return (
        <g transform={at}>
          <path d="M 20 -30 C -50 -50 -140 0 -150 100 C -154 140 -124 160 -100 146 C -80 110 -30 56 30 30 Z"
            fill={C.fur} {...st} />
          <path d="M -150 100 C -154 140 -124 160 -100 146 C -102 128 -112 112 -132 92 Z"
            fill={C.marking ?? shade(C.fur, 0.4)} {...st} />
        </g>
      );
    default:
      return null;
  }
};

/* ------------------------------------------------------------------ hair, hats, glasses */

/** The perm: a curly tuft between the ears (circles under one outline). */
export const PERM: [number, number, number][] = [[-78, -346, 34], [-40, -368, 37], [0, -374, 37], [40, -368, 37],
  [78, -350, 34], [-20, -346, 36], [24, -346, 36]];
const BUN: [number, number, number][] = [[0, -372, 36], [-34, -350, 28], [34, -350, 28]];

/** Hair on the crown (front view): the perm, the forelock, a neat bun. The slicked fur is in Animal.tsx. */
export const Hair: React.FC<{S: CharacterSpec; dx: number; back: boolean}> = ({S, dx, back}) => {
  const {lw, ks} = useInk();
  const h = S.hair ?? {style: "none"};
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const};
  if (h.style === "perm") {
    return (
      <Cloud circles={PERM.map(([x, y, r]) => [x + dx * 0.4, y, r] as [number, number, number])} fill={h.color ?? S.palette.fur}
        extra={(
          <g stroke={h.shade ?? shade(h.color ?? S.palette.fur, 0.2)} strokeWidth={4 * ks} fill="none" strokeLinecap="round">
            {PERM.slice(0, 5).map(([x, y], i) => <path key={i} d={`M ${x + dx * 0.4 - 12} ${y - 2} q 12 -12 24 0`} />)}
          </g>
        )} />
    );
  }
  if (h.style === "bun") {
    return (
      <Cloud circles={BUN.map(([x, y, r]) => [x + dx * 0.3, y, r] as [number, number, number])} fill={h.color ?? S.palette.fur}
        extra={(
          <path d={`M ${-30 + dx * 0.3} -342 q 30 14 60 0`} stroke={h.shade ?? shade(h.color ?? S.palette.fur, 0.2)}
            strokeWidth={4 * ks} fill="none" strokeLinecap="round" />
        )} />
    );
  }
  if (h.style === "forelock" && !back) {
    return (
      <path d={`M ${-34 + dx * 0.4} -346 Q ${-22 + dx * 0.4} -384 ${-2 + dx * 0.4} -366 Q ${8 + dx * 0.4} -392
          ${30 + dx * 0.4} -350`} fill={h.color ?? S.palette.fur} {...st} />
    );
  }
  return null;
};

/** A plain soft cap (no badge, no insignia, no institution): crown, band and a short brim; ears beside it. */
export const Hat: React.FC<{S: CharacterSpec; dx: number; back: boolean}> = ({S, dx, back}) => {
  const {lw, ks} = useInk();
  if (!S.hat) return null;
  const c = S.hat.color;
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const};
  const hx = dx * 0.5;
  return (
    <g transform={`translate(${hx} 0)`}>
      <path d="M -126 -300 C -132 -378 -62 -396 0 -396 C 62 -396 132 -378 126 -300 Z" fill={c} {...st} />
      <path d="M 0 -394 V -306" stroke={INK} strokeWidth={3.5 * ks} opacity={0.4} />
      <path d="M -126 -318 C -60 -330 60 -330 126 -318 L 126 -300 C 60 -312 -60 -312 -126 -300 Z" fill={shade(c, 0.2)} />
      {back ? null : (
        <path d="M -138 -302 C -80 -322 80 -322 138 -302 C 150 -280 110 -270 0 -274 C -110 -270 -150 -280 -138 -302 Z"
          fill={shade(c, 0.24)} {...st} />
      )}
      <circle cx={0} cy={-396} r={9} fill={shade(c, 0.2)} stroke={INK} strokeWidth={3.5 * ks} />
    </g>
  );
};

/** Thin round glasses over the eyes (a calm reader's look; the half-moon pair is in Animal.tsx). */
export const RoundGlasses: React.FC<{dx: number}> = ({dx}) => {
  const {ks} = useInk();
  return (
    <g transform={`translate(${dx} 0)`}>
      {[-1, 1].map((s) => <circle key={s} cx={s * 62} cy={RIG.eyeY} r={42} fill="rgba(220,236,245,0.14)" stroke={INK}
        strokeWidth={5.5 * ks} />)}
      <path d={`M -20 ${RIG.eyeY - 6} Q 0 ${RIG.eyeY - 16} 20 ${RIG.eyeY - 6}`} stroke={INK} strokeWidth={5 * ks} fill="none" />
      <path d={`M -104 ${RIG.eyeY - 4} L -150 ${RIG.eyeY - 16} M 104 ${RIG.eyeY - 4} L 150 ${RIG.eyeY - 16}`} stroke={INK}
        strokeWidth={4.5 * ks} />
    </g>
  );
};

/* ------------------------------------------------------------------ clothes and props (inside the torso's clip) */

/** The new generic outfits (the legacy seven are Character.tsx Costume). Front only; the back gets the rib. Short
 * lines only (a long front line makes the short torso read long); no logos, badges or insignia. */
export const Outfit: React.FC<{S: CharacterSpec; L: Look; B: BodySpec; back: boolean}> = ({S, L, B, back}) => {
  const {lw, ks} = useInk();
  const st = {stroke: INK, strokeWidth: lw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const};
  const thin = {stroke: INK, strokeWidth: 3.5 * ks, strokeLinecap: "round" as const, fill: "none"};
  const hw = Math.max(B.w, B.hip) + 4;
  const rib = <path d={`M ${-hw} ${B.hemY - 24} Q 0 ${B.hemY - 10} ${hw} ${B.hemY - 24}`} {...thin} opacity={0.55} />;
  if (back) return rib;
  switch (S.outfit.type) {
    case "workJacket":
      // a plain zip work jacket: a turned-down collar, a short zip, two flap pockets, the rib at the hem
      return (
        <g>
          <path d="M -40 -14 L 40 -14 L 0 40 Z" fill={L.inner} {...st} />
          {[-1, 1].map((s) => (
            <path key={s} d={`M ${s * 40} -16 L ${s * 104} 14 L ${s * 84} 58 L ${s * 6} 42 Z`} fill={shade(L.top, 0.14)} {...st} />
          ))}
          <path d="M 0 44 V 132" {...thin} />
          <rect x={-6} y={120} width={12} height={22} rx={4} fill={L.accent} stroke={INK} strokeWidth={3 * ks} />
          {[-1, 1].map((s) => (
            <g key={s}>
              <rect x={s > 0 ? 44 : -124} y={96} width={80} height={70} rx={8} {...thin} fill="rgba(0,0,0,0.06)" />
              <path d={`M ${s > 0 ? 44 : -124} 96 h 80 v 20 h -80 Z`} fill={shade(L.top, 0.14)} stroke={INK}
                strokeWidth={3.5 * ks} strokeLinejoin="round" />
            </g>
          ))}
          {rib}
        </g>
      );
    case "vest":
      // a blouse (the top) under a buttoned vest (accent), a soft neck scarf (inner)
      return (
        <g>
          {[-1, 1].map((s) => (
            <path key={s} d={`M ${s * 52} -14 L ${s * (B.sh + 10)} 20 L ${s * (hw + 10)} ${B.hemY + 30} L ${s * 4} ${B.hemY + 30}
              L ${s * 4} 150 Z`} fill={L.accent} {...st} />
          ))}
          {[178, 218].map((y) => <circle key={y} cx={-18} cy={y} r={8} fill={shade(L.accent, 0.3)} stroke={INK}
            strokeWidth={3 * ks} />)}
          <path d="M -46 -12 C -30 22 30 22 46 -12 C 34 6 -34 6 -46 -12 Z" fill={L.inner} {...st} />
          <path d="M -8 14 L -34 70 L -10 62 Z M 8 14 L 34 70 L 10 62 Z" fill={L.inner} {...st} />
          <circle cx={0} cy={14} r={11} fill={shade(L.inner, 0.12)} stroke={INK} strokeWidth={3.5 * ks} />
        </g>
      );
    case "knit":
      // a knit cardigan: a soft shawl collar, cable stitches each side, two buttons, the rib
      return (
        <g>
          <path d="M -50 -14 L 50 -14 L 0 112 Z" fill={L.inner} {...st} />
          {[-1, 1].map((s) => (
            <path key={s} d={`M ${s * 50} -16 C ${s * 96} 10 ${s * 64} 90 ${s * 4} 126 C ${s * 40} 76 ${s * 46} 26 ${s * 30} -6 Z`}
              fill={shade(L.top, -0.12)} {...st} />
          ))}
          {[-1, 1].map((s) => [60, 104, 148, 192].map((y) => (
            <path key={`${s}${y}`} d={`M ${s * 116} ${y} q ${s * 12} 12 0 24 q ${-s * 12} 12 0 24`} {...thin} opacity={0.45} />
          )))}
          {[160, 204].map((y) => <circle key={y} cx={0} cy={y} r={9} fill={L.accent} stroke={INK} strokeWidth={3.5 * ks} />)}
          {rib}
        </g>
      );
    default:
      return null;
  }
};

/** The one prop that says who the character is, on the chest (the headset is drawn on the head, Animal.tsx). Blank
 * and generic: a whistle on a cord, a blank name tag, a round brooch, a pen in the pocket. */
export const BodyProp: React.FC<{S: CharacterSpec; back: boolean}> = ({S, back}) => {
  const {ks} = useInk();
  if (back) return null;
  const thin = 3.5 * ks;
  switch (S.prop) {
    case "whistle":
      return (
        <g>
          <path d="M -30 -6 Q -20 70 40 104 M 30 -6 Q 40 50 40 104" stroke="#D8CFBE" strokeWidth={6} fill="none"
            strokeLinecap="round" />
          <g transform="translate(46 116) rotate(-20)">
            <rect x={-26} y={-12} width={46} height={26} rx={12} fill="#C9CDD2" stroke={INK} strokeWidth={thin} />
            <rect x={14} y={-10} width={18} height={12} rx={4} fill="#A9AEB5" stroke={INK} strokeWidth={thin} />
          </g>
        </g>
      );
    case "nameTag":
      return (
        <g transform="translate(-104 104) rotate(-3)">
          <rect x={-46} y={-22} width={92} height={44} rx={8} fill="#F4F0E6" stroke={INK} strokeWidth={thin} />
          <path d="M -30 -4 h 60 M -30 10 h 36" stroke="#B8B0A0" strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    case "brooch":
      return (
        <g transform="translate(-92 70)">
          <circle r={20} fill="#D8C9A8" stroke={INK} strokeWidth={thin} />
          <circle r={9} fill="#8A9A8C" stroke={INK} strokeWidth={3 * ks} />
        </g>
      );
    case "pen":
      return (
        <g transform="translate(96 74) rotate(8)">
          <rect x={-7} y={-34} width={14} height={60} rx={6} fill="#3E4A5C" stroke={INK} strokeWidth={thin} />
          <rect x={-2} y={-34} width={4} height={30} fill="#C9CDD2" />
        </g>
      );
    default:
      return null;
  }
};
