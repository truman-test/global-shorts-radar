// Channel art (not part of a Short): the YouTube profile picture and banner of 디지털 생존노트, drawn from the same
// registry, tokens and fonts as the skits, so the channel page looks like the videos. Static stills (one frame,
// nothing animated), rendered from plain props:
//   npx remotion still src/index.ts ChannelProfile out.png
//   npx remotion still src/index.ts ChannelBanner out.png --props='{"types": true}'
// 2026-10-14 (v3): the characters are cast per story, so the art no longer centres on one family. The banner shows
// "평범한 이웃들": everyday neighbours of different ages and species from the registry (content/characters), each
// with a phone and a calm "안 속아" look (suspicious / smug, never shocked); the one in front holds up a ringing
// "모르는 번호" call (a generic, invented call screen). Across the card the fox caller, caught in a disguise that
// leaks (Disguise.tsx: his ears and tail stay out), wears a "사기꾼" name tag under a "사기 실패" stamp. The profile
// picture is 도치 from the front, spikes up: the channel's alarm, the one face that is in every episode.
// Banner geometry follows YouTube's guide: 2560x1440 canvas, every key element inside the 1546x423 centre (the mobile
// crop, also the middle of the 2560x423 desktop crop). v4 (2026-10-14, after YouTube's crop tool cut v3's cast at the
// chest and 도치 at the band's top): every key element lies wholly in that band with MARGIN to spare, the figures
// whole (ears to feet, smaller), 도치 lowered with the card; outside the band only decoration (paper / dark sides,
// the slant, 엄마 in the desktop-only strip). Honest: a dramatized-fiction channel (no agency look, no seal, no real brands or numbers).
import React from "react";
import {AbsoluteFill} from "remotion";
import {Phone, PhoneOff} from "lucide-react";
import {Character} from "./Actor";
import {FONT} from "./fonts";
import {Stamp} from "./Handwriting";
import {Dochi, DochiFront, Pose as DochiPose} from "./Mascot";
import {REGISTRY} from "./registry";
import {neckY} from "./rig";
import {CAPTION, DRAMA, MASCOT_PALETTES, NOTE, TONES} from "./themes";
import {CharPose} from "./Character";
import {CostumeId, Expression, Gesture} from "./types";

/* ------------------------------------------------------------------ shared */

const INK = NOTE.ink;
const YELLOW = DRAMA.title.band; // the channel's one accent (the title band)
const PAPER_BG = "#F4EEE2"; // the lineup / notebook paper
const NIGHT = "#1B1E27"; // the fox's side: the dark call room

/** The banner's copy: the promise in plain words, tied to the name (생존노트 = notes on surviving), and the kinds of
 * scams the skits play (the small second line). */
export const TAGLINE = {
  main: "디지털 사기에서 살아남는 법",
  types: "보이스피싱 · 문자 사기 · 가짜 투자 광고",
} as const;

/** A registry character, posed for a still (frame 0, no talking). `ink` thickens the outline (1 = the skits'). */
const Actor: React.FC<{id: string; x: number; eyeY: number; k: number; expr: Expression; gesture?: Gesture;
  turn?: number; tilt?: number; fx?: CharPose["fx"]; mirror?: boolean; look?: [number, number]; ink?: number;
  w: number; h: number; uid: string; rim?: string; tail?: boolean; costume?: CostumeId}> = ({id, x, eyeY, k, expr,
  gesture = "rest", turn = 0, tilt = 0, fx = [], mirror, look = [0, 0], ink = 1, w, h, uid, rim, tail, costume}) => {
  const pose: CharPose = {id, x, y: neckY(eyeY, k), k, px: k / ink, expr, gesture, turn, tilt, fx, mirror, look,
    blink: 0, rim, rimWidth: rim ? 6 : undefined, tail, costume};
  return <Character pose={pose} uid={uid} box={{w, h}} frame={0} skin="animal" />;
};

const dochiPose = (x: number, y: number, size: number, over: Partial<DochiPose> = {}): DochiPose => ({x, y, size,
  lookX: 0.8, lookY: 0, expr: "neutral", paw: "none", pawAngle: 0, tilt: 0, bristle: 0, shiver: 0, curl: 0,
  sweat: false, sy: 1, lift: 0, walk: 0, opacity: 1, talk: 0, ...over});

/* ------------------------------------------------------------------ profile picture */

export type ChannelProfileProps = {subject: "mother" | "dochi"; bg: "yellow" | "ink"; expr?: Expression};

/**
 * The profile picture (800x800; YouTube shows it as a 98 px circle, often ~40 px): one face filling the circle, a
 * thick outline so the silhouette survives the downscale, no text. 도치 from the front with its spikes up (the
 * channel's alarm, in every episode whoever the cast is), or the earlier 황 여사 face (kept for comparison) with
 * her "확인은 내가 직접 해" look. On the caption highlight yellow (or the ink field with a yellow disc).
 */
export const ChannelProfile: React.FC<ChannelProfileProps> = ({subject, bg, expr = "suspicious"}) => {
  const S = 800;
  const field = bg === "yellow" ? CAPTION.highlight : INK;
  return (
    <AbsoluteFill style={{background: field, overflow: "hidden"}}>
      {/* on the dark field a yellow disc behind the head, so the face still sits on the accent */}
      {bg === "ink" ? <div style={{position: "absolute", left: S / 2 - 330, top: S / 2 - 350, width: 660, height: 660,
        borderRadius: "50%", background: YELLOW}} /> : null}
      {subject === "mother" ? (
        <Actor id="mother" x={S / 2 + 4} eyeY={468} k={1.36} expr={expr} tilt={-5} turn={0.08} look={[0.15, 0]}
          ink={1.9} w={S} h={S} uid="pf" />
      ) : (
        <DochiFront pose={{cx: S / 2, cy: 452, size: 520, bristle: 1, expr: "alarmed", ink: 1.55}}
          palette={MASCOT_PALETTES.paper} />
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ banner */

export type ChannelBannerProps = {types?: boolean; guides?: boolean; costume?: CostumeId};

export const BANNER = {w: 2560, h: 1440, safe: {w: 1546, h: 423}} as const;
const SX = (BANNER.w - BANNER.safe.w) / 2; // 507
const SY = Math.round((BANNER.h - BANNER.safe.h) / 2); // 509
/** Safe-area coordinates -> canvas. */
const X = (sx: number) => SX + sx;
const Y = (sy: number) => SY + sy;
/** v4: every key element keeps at least this much air inside the safe area ("모든 기기에 표시 가능"), so the phone
 * view looks composed, not cropped. */
export const MARGIN = 16;

/**
 * Each figure's extent round its eye line and x, in px per unit of k (measured from a transparent still of exactly
 * the pose the banner uses, outline, rim and ground shadow included): top = eyeY - up*k, bottom = eyeY + down*k.
 * The layout below is checked against these (tests/test_channel_art.py), so a whole figure, ears to shadow, lies in
 * the band. Re-measure if a pose changes.
 */
export const FIGURE: Record<string, {up: number; down: number; left: number; right: number}> = {
  rabbit_teller: {up: 180, down: 902, left: 230, right: 230},
  raccoon_neighbor: {up: 236, down: 826, left: 232, right: 232},
  cat_guard: {up: 234, down: 826, left: 232, right: 282},
  mother: {up: 238, down: 826, left: 230, right: 230},
  scammer: {up: 246, down: 956, left: 328, right: 302},
};
/** 도치's extent per unit of size round its foot point (spikes up, alarmed). */
export const DOCHI_EXTENT = {up: 0.93, down: 0.08, left: 0.71, right: 0.56};

/** The fox's side: a dark panel cut on a slant, right of `x0` at mid-height. */
const SLANT = {x0: X(1186), dx: 0.1};
const slantX = (y: number) => SLANT.x0 - (y - BANNER.h / 2) * SLANT.dx;

/** Faint notebook grid (light side) and call-room rings (dark side): texture for the TV view. */
const Grid: React.FC = () => (
  <svg width={BANNER.w} height={BANNER.h} style={{position: "absolute", left: 0, top: 0}}>
    <defs>
      <pattern id="ca-grid" width={56} height={56} patternUnits="userSpaceOnUse">
        <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(23,24,28,0.07)" strokeWidth={2} />
      </pattern>
    </defs>
    <rect width={BANNER.w} height={BANNER.h} fill="url(#ca-grid)" />
  </svg>
);

const Rings: React.FC<{cx: number; cy: number}> = ({cx, cy}) => (
  <svg width={BANNER.w} height={BANNER.h} style={{position: "absolute", left: 0, top: 0}}>
    {Array.from({length: 9}, (_, i) => (
      <circle key={i} cx={cx} cy={cy} r={150 + i * 120} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={3} />
    ))}
  </svg>
);

/** The call screen colours: a generic dark incoming-call screen (no real phone maker's or carrier's look). */
const CALL = {bezel: "#17181C", screen: "#262C3A", text: "#FFFFFF", muted: "#C3CADA", avatar: "#4A5468",
  decline: TONES.danger.fill, accept: TONES.safe.fill};

/**
 * The phone held up to the viewer: an invented incoming-call screen ("수신 전화", a "?" caller, "모르는 번호",
 * decline / accept buttons, ringing rings round the avatar), so "a call from an unknown number" reads with no text.
 * Sized from its width (w 184 = the v2 phone).
 */
const CallPhone: React.FC<{cx: number; cy: number; w: number; h: number; rotate: number}> = ({cx, cy, w, h, rotate}) => {
  const q = w / 184;
  const pad = 9 * q;
  const btn = Math.round(w * 0.3);
  return (
    <div style={{position: "absolute", left: cx - w / 2, top: cy - h / 2, width: w, height: h,
      transform: `rotate(${rotate}deg)`, fontFamily: FONT}}>
      <div style={{position: "absolute", inset: 0, borderRadius: 34 * q, background: CALL.bezel,
        boxShadow: `0 0 0 ${5 * q}px ${INK}, 0 14px 24px rgba(10,14,25,0.3)`}} />
      <div style={{position: "absolute", left: pad, top: pad, right: pad, bottom: pad, borderRadius: 26 * q,
        background: CALL.screen, display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden"}}>
        <div style={{marginTop: 28 * q, fontSize: 21 * q, fontWeight: 700, color: CALL.muted, letterSpacing: 0}}>수신 전화</div>
        {/* the caller: a "?" avatar inside two faint ringing rings */}
        <div style={{marginTop: 16 * q, width: 78 * q, height: 78 * q, borderRadius: "50%", background: CALL.avatar,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50 * q, fontWeight: 900,
          color: CALL.text, lineHeight: 1,
          boxShadow: `0 0 0 ${9 * q}px rgba(255,255,255,0.12), 0 0 0 ${18 * q}px rgba(255,255,255,0.06)`}}>?</div>
        <div style={{marginTop: 14 * q, fontSize: 30 * q, fontWeight: 900, color: CALL.text, letterSpacing: -1,
          whiteSpace: "nowrap"}}>모르는 번호</div>
        <div style={{flex: 1}} />
        <div style={{marginBottom: 24 * q, width: "100%", display: "flex", justifyContent: "space-evenly"}}>
          <div style={{width: btn, height: btn, borderRadius: "50%", background: CALL.decline, display: "flex",
            alignItems: "center", justifyContent: "center"}}>
            <PhoneOff size={btn * 0.5} color="#FFFFFF" strokeWidth={2.6} />
          </div>
          <div style={{width: btn, height: btn, borderRadius: "50%", background: CALL.accept, display: "flex",
            alignItems: "center", justifyContent: "center"}}>
            <Phone size={btn * 0.48} color="#FFFFFF" strokeWidth={2.6} />
          </div>
        </div>
      </div>
    </div>
  );
};

/** A paw over the phone's edge (the holder's paw colour from the registry, two toe seams): the grip. */
const GripPaw: React.FC<{cx: number; cy: number; fill: string; r?: number}> = ({cx, cy, fill, r = 1}) => (
  <svg width={120} height={110} style={{position: "absolute", left: cx - 60, top: cy - 55, overflow: "visible"}}>
    <g transform={`translate(60 55) rotate(-24) scale(${r})`}>
      <ellipse rx={40} ry={34} fill={fill} stroke={INK} strokeWidth={6.5} />
      <path d="M 14 -16 L 34 -16 M 14 0 L 38 0 M 14 16 L 34 16" stroke={INK} strokeWidth={4} strokeLinecap="round" />
    </g>
  </svg>
);

/** The fox's name tag: a stick-on badge (red header, white field) that says what he is, "사기꾼" (s = scale). */
const NameTag: React.FC<{cx: number; cy: number; text: string; rotate: number; s?: number}> = ({cx, cy, text, rotate,
  s = 1}) => {
  const w = 176 * s;
  const h = 92 * s;
  return (
    <div style={{position: "absolute", left: cx - w / 2, top: cy - h / 2, width: w, height: h, borderRadius: 14 * s,
      background: NOTE.paper, overflow: "hidden", transform: `rotate(${rotate}deg)`, fontFamily: FONT,
      boxShadow: `0 0 0 ${4 * s}px ${INK}, 0 8px 14px rgba(0,0,0,0.35)`, display: "flex", flexDirection: "column"}}>
      <div style={{height: 24 * s, background: TONES.danger.fill}} />
      <div style={{flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44 * s,
        fontWeight: 900, color: INK, letterSpacing: -1, lineHeight: 1, whiteSpace: "nowrap"}}>{text}</div>
    </div>
  );
};

/** One neighbour on the banner (safe-area x, eye line; drawn back to front in this order). */
type Neighbour = {id: string; x: number; eyeY: number; k: number; expr: Expression; gesture: Gesture; turn: number;
  tilt: number; look: [number, number]};

/**
 * "평범한 이웃들" in the safe area, whole figures from ears to feet (v4: the band shows them complete, never cut at
 * the chest): registry characters of different ages and species (no fixed family), each with a phone, none fooled:
 * 창구 직원 (young 토끼, suspicious over her glasses), 옆집 아주머니 (너구리, smug) and, in front, 경비 할아버지
 * (고양이) holding the unknown call up with a suspicious "어림없지" (the suspicious look keeps the eye whites, which
 * still read when the banner is 390 px wide; smug half-lids read as sleepy there). One ground line near the band's
 * foot, the one in front a little bigger.
 */
export const NEIGHBOURS: Neighbour[] = [
  {id: "rabbit_teller", x: 100, eyeY: 96, k: 0.33, expr: "suspicious", gesture: "phoneRead", turn: 0.3, tilt: 3,
    look: [0.8, 0]},
  {id: "raccoon_neighbor", x: 205, eyeY: 122, k: 0.335, expr: "smug", gesture: "phoneRead", turn: 0.3, tilt: -3,
    look: [0.8, 0]},
  {id: "cat_guard", x: 312, eyeY: 107, k: 0.36, expr: "suspicious", gesture: "palmOut", turn: 0.2, tilt: -4,
    look: [0.8, -0.1]},
];

/** Desktop / TV only (left of the safe area, wholly outside it, so the phone view never shows half of her): one
 * more neighbour, 엄마 (진돗개). Decoration, not needed to read the banner. */
export const EXTRA: Neighbour = {id: "mother", x: -104, eyeY: 120, k: 0.335, expr: "suspicious", gesture: "phoneRead",
  turn: 0.3, tilt: -2, look: [0.8, -0.1]};

/** The key elements in safe-area coordinates (each one must lie in the band with MARGIN to spare). */
export const LAYOUT = {
  card: {l: 552, t: 96, w: 584, h: 272},
  phone: {cx: 436, cy: 170, w: 144, h: 252, rotate: 5},
  fox: {x: 1318, eyeY: 99, k: 0.32},
  tag: {cx: 1290, cy: 232, s: 0.72, rotate: -6},
  stamp: {x: 1402, y: 338, font: 40, w: 214, h: 90, rotate: -8},
  dochi: {inset: 62, sink: 8, size: 76},
} as const;

type Box = {l: number; t: number; r: number; b: number; name: string};
const figureBox = (name: string, id: string, x: number, eyeY: number, k: number): Box => {
  const f = FIGURE[id];
  return {name, l: x - f.left * k, t: eyeY - f.up * k, r: x + f.right * k, b: eyeY + f.down * k};
};
/** A w x h box rotated by `deg` round its centre: its axis-aligned extent. */
const rotBox = (name: string, cx: number, cy: number, w: number, h: number, deg: number): Box => {
  const a = (Math.abs(deg) * Math.PI) / 180;
  const hw = (w / 2) * Math.cos(a) + (h / 2) * Math.sin(a);
  const hh = (h / 2) * Math.cos(a) + (w / 2) * Math.sin(a);
  return {name, l: cx - hw, t: cy - hh, r: cx + hw, b: cy + hh};
};

/** Every key element's box in safe-area coordinates (the guides draw them; the tests recompute them). */
export const keyBoxes = (): Box[] => {
  const {card, phone, fox, tag, stamp, dochi} = LAYOUT;
  const dx = card.l + card.w - dochi.inset;
  const dy = card.t + dochi.sink;
  return [
    ...NEIGHBOURS.map((n) => figureBox(n.id, n.id, n.x, n.eyeY, n.k)),
    {name: "card", l: card.l, t: card.t, r: card.l + card.w, b: card.t + card.h},
    rotBox("phone", phone.cx, phone.cy, phone.w + 10, phone.h + 10, phone.rotate),
    figureBox("fox", "scammer", fox.x, fox.eyeY, fox.k),
    rotBox("tag", tag.cx, tag.cy, 184 * tag.s, 100 * tag.s, tag.rotate),
    rotBox("stamp", stamp.x, stamp.y, stamp.w + 20, stamp.h + 20, stamp.rotate + 2),
    {name: "dochi", l: dx - DOCHI_EXTENT.left * dochi.size, t: dy - DOCHI_EXTENT.up * dochi.size,
      r: dx + DOCHI_EXTENT.right * dochi.size, b: dy + DOCHI_EXTENT.down * dochi.size},
  ];
};

export const ChannelBanner: React.FC<ChannelBannerProps> = ({types = true, guides, costume = "bank_suit"}) => {
  const W = BANNER.w;
  const H = BANNER.h;
  const {card: c, phone: p, fox: f, tag, stamp, dochi} = LAYOUT;
  const card = {l: X(c.l), t: Y(c.t), w: c.w, h: c.h};
  const fox = {x: X(f.x), eyeY: Y(f.eyeY), k: f.k};
  const phone = {cx: X(p.cx), cy: Y(p.cy), w: p.w, h: p.h, rotate: p.rotate};
  const holder = NEIGHBOURS[NEIGHBOURS.length - 1];
  return (
    <AbsoluteFill style={{background: PAPER_BG, fontFamily: FONT, overflow: "hidden"}}>
      <Grid />
      {/* the fox's side */}
      <div style={{position: "absolute", inset: 0, background: NIGHT,
        clipPath: `polygon(${slantX(0)}px 0, ${W}px 0, ${W}px ${H}px, ${slantX(H)}px ${H}px)`}}>
        <Rings cx={fox.x} cy={fox.eyeY + 60} />
      </div>
      {/* the seam: a yellow band along the slant (the accent, once) */}
      <svg width={W} height={H} style={{position: "absolute", left: 0, top: 0}}>
        <path d={`M ${slantX(0)} 0 L ${slantX(H)} ${H}`} stroke={YELLOW} strokeWidth={12} />
      </svg>
      {/* the neighbours, back to front; the one in front holds the unknown call up (its paw drawn again as the grip) */}
      {[EXTRA, ...NEIGHBOURS].map((n, i) => (
        <Actor key={n.id} id={n.id} x={SX + n.x} eyeY={SY + n.eyeY} k={n.k} expr={n.expr} gesture={n.gesture} turn={n.turn}
          tilt={n.tilt} look={n.look} w={W} h={H} uid={`bn${i}`} ink={1.15} />
      ))}
      <CallPhone {...phone} />
      <GripPaw cx={phone.cx - phone.w * 0.36} cy={phone.cy + phone.h * 0.42} r={0.72}
        fill={REGISTRY[holder.id]?.palette.paw ?? "#A8A39A"} />

      {/* the fox caller, caught in his disguise (ears and tail out): hand on head, sweating, the name tag, the stamp */}
      <Actor id="scammer" costume={costume} x={fox.x} eyeY={fox.eyeY} k={fox.k} expr="panicked" gesture="handOnHead"
        turn={-0.3} fx={["sweat2"]} look={[-0.5, 0.2]} w={W} h={H} uid="bx" rim="#EEE8DE" ink={1.15} tail />
      <NameTag cx={X(tag.cx)} cy={Y(tag.cy)} s={tag.s} text="사기꾼" rotate={tag.rotate} />
      <Stamp text="사기 실패" at={-30} x={X(stamp.x)} y={Y(stamp.y)} rotate={stamp.rotate}
        look={{shape: "box", font: stamp.font, w: stamp.w, h: stamp.h}} />

      {/* the note card: the channel name, the promise under it, the kinds of scams */}
      <div style={{position: "absolute", left: card.l, top: card.t, width: card.w, height: card.h,
        filter: "drop-shadow(0 12px 20px rgba(10,14,25,0.22)) drop-shadow(0 2px 3px rgba(10,14,25,0.12))"}}>
        <div style={{position: "relative", width: "100%", height: "100%", background: NOTE.paper, borderRadius: NOTE.radius,
          border: `5px solid ${INK}`, boxSizing: "border-box", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 14, wordBreak: "keep-all", textAlign: "center"}}>
          <div style={{fontSize: 88, fontWeight: 900, color: INK, letterSpacing: -3, lineHeight: 1}}>디지털 생존노트</div>
          <div style={{fontSize: 43, fontWeight: 800, color: INK, letterSpacing: -1, lineHeight: 1.15, padding: "2px 16px",
            background: `linear-gradient(transparent 52%, ${YELLOW} 52%, ${YELLOW} 92%, transparent 92%)`}}>{TAGLINE.main}</div>
          {types ? (
            <div style={{fontSize: 28, fontWeight: 700, color: "#4A4F5C", letterSpacing: -0.5, lineHeight: 1}}>
              {TAGLINE.types}</div>
          ) : null}
        </div>
      </div>

      {/* 도치, the silent alarm (the profile picture's face): small, standing on the card's top corner (low enough to
          stay whole in the band), spikes up, eyes on the fox */}
      <div style={{position: "absolute", left: 0, top: 0}}>
        <Dochi pose={dochiPose(card.l + card.w - dochi.inset, card.t + dochi.sink, dochi.size, {expr: "alarmed",
          bristle: 1, lookX: 1, lookY: -0.2, tilt: -4})} blink={0} frame={0} palette={MASCOT_PALETTES.paper} />
      </div>
      {guides ? (
        <>
          <div style={{position: "absolute", left: SX, top: SY, width: BANNER.safe.w, height: BANNER.safe.h,
            outline: `4px dashed ${TONES.danger.fill}`}} />
          <div style={{position: "absolute", left: SX + MARGIN, top: SY + MARGIN, width: BANNER.safe.w - 2 * MARGIN,
            height: BANNER.safe.h - 2 * MARGIN, outline: "2px dotted rgba(220,38,38,0.6)"}} />
          <div style={{position: "absolute", left: 0, top: SY, width: W, height: BANNER.safe.h,
            outline: "3px dashed #3B82F6"}} />
          {keyBoxes().map((b) => (
            <div key={b.name} style={{position: "absolute", left: X(b.l), top: Y(b.t), width: b.r - b.l,
              height: b.b - b.t, outline: "2px solid #06B6D4"}} />
          ))}
        </>
      ) : null}
    </AbsoluteFill>
  );
};
