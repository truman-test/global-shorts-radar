// Channel art (not part of a Short): the YouTube profile picture and banner of 디지털 생존노트, drawn from the same
// cast, tokens and fonts as the skits (진돗개네 vs 여 과장, the series scoreboard, 도치 as the silent alarm), so the
// channel page looks like the videos. Static stills (one frame, nothing animated), rendered from plain props:
//   npx remotion still src/index.ts ChannelProfile out.png
//   npx remotion still src/index.ts ChannelBanner out.png --props='{"home": 4}'
// Banner geometry follows YouTube's guide: 2560x1440 canvas, every key element inside the 1546x423 centre (the mobile
// crop, also the middle of the 2560x423 desktop crop); the rest is the TV view and only carries the background and
// the cast's full figures. Honest: a dramatized-fiction channel (no agency look, no seal, no real brands or numbers).
import React from "react";
import {AbsoluteFill} from "remotion";
import {Character} from "./Actor";
import {FONT} from "./fonts";
import {Stamp} from "./Handwriting";
import {Dochi, Pose as DochiPose} from "./Mascot";
import {neckY} from "./rig";
import {SCORE_LABELS} from "./Packaging";
import {CAPTION, DRAMA, MASCOT_PALETTES, NOTE, TONES} from "./themes";
import {CharPose} from "./Character";
import {CharacterId, Expression, Gesture} from "./types";

/* ------------------------------------------------------------------ shared */

const INK = NOTE.ink;
const YELLOW = DRAMA.title.band; // the channel's one accent (the title band, the winner's tile)
const PAPER_BG = "#F4EEE2"; // the lineup / notebook paper
const NIGHT = "#1B1E27"; // the fox's side: the dark call room

export const PROMISES = {
  main: "사기꾼 여우가 잘못 걸리는 30초",
  alt1: "여우가 전화하면, 진돗개네가 받아친다",
  alt2: "오늘도 여우는 0점",
} as const;
export type PromiseKey = keyof typeof PROMISES;

/** A cast member, posed for a still (frame 0, no talking). `ink` thickens the outline (1 = the skits' 7.5 px). */
const Actor: React.FC<{id: CharacterId; x: number; eyeY: number; k: number; expr: Expression; gesture?: Gesture;
  turn?: number; tilt?: number; fx?: CharPose["fx"]; mirror?: boolean; look?: [number, number]; ink?: number;
  w: number; h: number; uid: string; rim?: string; tail?: boolean}> = ({id, x, eyeY, k, expr, gesture = "rest", turn = 0,
  tilt = 0, fx = [], mirror, look = [0, 0], ink = 1, w, h, uid, rim, tail}) => {
  const pose: CharPose = {id, x, y: neckY(eyeY, k), k, px: k / ink, expr, gesture, turn, tilt, fx, mirror, look,
    blink: 0, rim, rimWidth: rim ? 6 : undefined, tail};
  return <Character pose={pose} uid={uid} box={{w, h}} frame={0} skin="animal" />;
};

const dochiPose = (x: number, y: number, size: number, over: Partial<DochiPose> = {}): DochiPose => ({x, y, size,
  lookX: 0.8, lookY: 0, expr: "neutral", paw: "none", pawAngle: 0, tilt: 0, bristle: 0, shiver: 0, curl: 0,
  sweat: false, sy: 1, lift: 0, walk: 0, opacity: 1, talk: 0, ...over});

/** The scoreboard chip of the skits' last beat ("진돗개네 [N] : [0] 여우"), static: home's tile on the winner yellow. */
export const ScoreChip: React.FC<{home: number; fox?: number; scale?: number}> = ({home, fox = 0, scale = 1}) => {
  const c = DRAMA.score;
  const font = 34 * scale;
  const tile = {w: 62 * scale, h: 66 * scale};
  const digit = (n: number, win: boolean) => (
    <div style={{width: tile.w, height: tile.h, borderRadius: 12 * scale, background: win ? c.win : c.tile,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52 * scale, fontWeight: 900,
      color: c.digit, lineHeight: 1, fontVariantNumeric: "tabular-nums", position: "relative"}}>
      {n}
      <div style={{position: "absolute", left: 0, right: 0, top: tile.h / 2 - 1, height: 2, background: "rgba(0,0,0,0.12)"}} />
    </div>
  );
  const label = (t: string) => <div style={{fontSize: font, fontWeight: 800, color: c.label, whiteSpace: "nowrap"}}>{t}</div>;
  return (
    <div style={{display: "inline-flex", alignItems: "center", gap: 14 * scale, padding: `${11 * scale}px ${24 * scale}px`,
      background: c.plate, borderRadius: 22 * scale, boxShadow: `0 0 0 ${4 * scale}px ${c.ring}, 0 10px 22px rgba(10,14,25,0.28)`,
      fontFamily: FONT}}>
      {label(SCORE_LABELS.home)}
      {digit(home, home >= fox)}
      <div style={{fontSize: 46 * scale, fontWeight: 900, color: c.colon, lineHeight: 1, marginTop: -6 * scale}}>:</div>
      {digit(fox, fox > home)}
      {label(SCORE_LABELS.fox)}
    </div>
  );
};

/* ------------------------------------------------------------------ profile picture */

export type ChannelProfileProps = {subject: "mother" | "dochi"; bg: "yellow" | "ink"; expr?: Expression};

/**
 * The profile picture (800x800; YouTube shows it as a 98 px circle, often ~40 px): one face, filling the circle,
 * a thick outline so the silhouette survives the downscale. 황 여사 (the perm reads at any size) with her
 * "확인은 내가 직접 해" look (suspicious: one brow up, the eye whites still read at 40 px, where the smug half-lids
 * read as sleepy), on the caption highlight yellow; or 도치 with its spikes up (reads, but cropped and in profile).
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
        <div style={{position: "absolute", left: 0, top: 0}}>
          <Dochi pose={dochiPose(S / 2 - 40, 650, 560, {expr: "alarmed", bristle: 0.85, lookX: 0.4})} blink={0}
            frame={0} palette={MASCOT_PALETTES.paper} />
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ banner */

export type ChannelBannerProps = {home: number; promise: PromiseKey; guides?: boolean};

export const BANNER = {w: 2560, h: 1440, safe: {w: 1546, h: 423}} as const;
const SX = (BANNER.w - BANNER.safe.w) / 2; // 507
const SY = Math.round((BANNER.h - BANNER.safe.h) / 2); // 509
/** Safe-area coordinates -> canvas. */
const X = (sx: number) => SX + sx;
const Y = (sy: number) => SY + sy;

/** The fox's side: a dark panel cut on a slant, right of `x0` at mid-height. */
const SLANT = {x0: X(1196), dx: 0.1};
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
      <circle key={i} cx={cx} cy={cy} r={170 + i * 120} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={3} />
    ))}
  </svg>
);

export const ChannelBanner: React.FC<ChannelBannerProps> = ({home, promise, guides}) => {
  const W = BANNER.w;
  const H = BANNER.h;
  const line = PROMISES[promise] ?? PROMISES.main;
  const card = {l: X(452), t: Y(110), w: 720, h: 290};
  const fox = {x: X(1376), eyeY: Y(166), k: 0.62};
  return (
    <AbsoluteFill style={{background: PAPER_BG, fontFamily: FONT, overflow: "hidden"}}>
      <Grid />
      {/* the fox's side */}
      <div style={{position: "absolute", inset: 0, background: NIGHT,
        clipPath: `polygon(${slantX(0)}px 0, ${W}px 0, ${W}px ${H}px, ${slantX(H)}px ${H}px)`}}>
        <Rings cx={fox.x} cy={fox.eyeY} />
      </div>
      {/* the seam: a yellow band along the slant (the accent, once) */}
      <svg width={W} height={H} style={{position: "absolute", left: 0, top: 0}}>
        <path d={`M ${slantX(0)} 0 L ${slantX(H)} ${H}`} stroke={YELLOW} strokeWidth={14} />
      </svg>
      {/* 진돗개네: 백 반장 behind, 황 여사 in front (the protagonist), both pleased with themselves */}
      <Actor id="father" x={X(118)} eyeY={Y(176)} k={0.56} expr="smug" turn={0.3} tilt={3} look={[0.6, 0]}
        w={W} h={H} uid="bf" ink={1.15} />
      <Actor id="mother" x={X(312)} eyeY={Y(196)} k={0.64} expr="smug" gesture="palmOut" turn={0.25} tilt={-4}
        look={[0.7, 0]} w={W} h={H} uid="bm" ink={1.15} />

      {/* 여 과장, caught: hand on head, sweating, under the stamp */}
      <Actor id="scammer" x={fox.x} eyeY={fox.eyeY} k={fox.k} expr="panicked" gesture="handOnHead" turn={-0.3}
        fx={["sweat2"]} look={[-0.5, 0.2]} w={W} h={H} uid="bx" rim="#EEE8DE" ink={1.15} tail />
      <Stamp text="작전 실패" at={-30} x={fox.x - 10} y={Y(334)} rotate={-9}
        look={{shape: "box", font: 66, w: 330, h: 116}} />

      {/* the note card: channel name, the promise, the scoreboard as a tab on its top edge */}
      <div style={{position: "absolute", left: card.l, top: card.t, width: card.w, height: card.h,
        filter: "drop-shadow(0 18px 28px rgba(10,14,25,0.22)) drop-shadow(0 2px 3px rgba(10,14,25,0.12))"}}>
        <div style={{position: "relative", width: "100%", height: "100%", background: NOTE.paper, borderRadius: NOTE.radius,
          border: `5px solid ${INK}`, boxSizing: "border-box", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", paddingTop: 34, gap: 14, wordBreak: "keep-all", textAlign: "center"}}>
          <div style={{fontSize: 104, fontWeight: 900, color: INK, letterSpacing: -3, lineHeight: 1}}>디지털 생존노트</div>
          <div style={{fontSize: 46, fontWeight: 800, color: INK, letterSpacing: -1, lineHeight: 1.15, padding: "4px 18px",
            background: `linear-gradient(transparent 52%, ${YELLOW} 52%, ${YELLOW} 92%, transparent 92%)`}}>{line}</div>
        </div>
      </div>
      <div style={{position: "absolute", left: card.l, width: card.w, top: card.t - 44, display: "flex",
        justifyContent: "center"}}>
        <ScoreChip home={home} />
      </div>

      {/* 도치, the silent alarm: on the card's corner, spikes up, eyes on the fox */}
      <div style={{position: "absolute", left: 0, top: 0}}>
        <Dochi pose={dochiPose(card.l + card.w - 84, card.t + 8, 100, {expr: "alarmed", bristle: 1, lookX: 1,
          lookY: -0.2, tilt: -4})} blink={0} frame={0} palette={MASCOT_PALETTES.paper} />
      </div>
      {guides ? (
        <>
          <div style={{position: "absolute", left: SX, top: SY, width: BANNER.safe.w, height: BANNER.safe.h,
            outline: `4px dashed ${TONES.danger.fill}`}} />
          <div style={{position: "absolute", left: 0, top: SY, width: W, height: BANNER.safe.h,
            outline: "3px dashed #3B82F6"}} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
