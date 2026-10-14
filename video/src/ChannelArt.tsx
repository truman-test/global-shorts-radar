// Channel art (not part of a Short): the YouTube profile picture and banner of 디지털 생존노트, drawn from the same
// cast, tokens and fonts as the skits (진돗개네 vs 여 과장, 도치 as the silent alarm), so the channel page looks like
// the videos. Static stills (one frame, nothing animated), rendered from plain props:
//   npx remotion still src/index.ts ChannelProfile out.png
//   npx remotion still src/index.ts ChannelBanner out.png --props='{"types": true}'
// The banner tells a stranger the topic without reading: 황 여사 holds up a ringing "모르는 번호" call (a generic,
// invented call screen), the fox caller wears a "사기꾼" name tag under a "사기 실패" stamp, and the family carries a
// small green "생존" check. No score anywhere (2026-10-14: the feeling is "the scammer gets caught", not a tally).
// Banner geometry follows YouTube's guide: 2560x1440 canvas, every key element inside the 1546x423 centre (the mobile
// crop, also the middle of the 2560x423 desktop crop); the rest is the TV view and only carries the background and
// the cast's full figures. Honest: a dramatized-fiction channel (no agency look, no seal, no real brands or numbers).
import React from "react";
import {AbsoluteFill} from "remotion";
import {Check, Phone, PhoneOff} from "lucide-react";
import {Character} from "./Actor";
import {FONT} from "./fonts";
import {Stamp} from "./Handwriting";
import {Dochi, Pose as DochiPose} from "./Mascot";
import {neckY} from "./rig";
import {CAPTION, DRAMA, MASCOT_PALETTES, NOTE, TONES} from "./themes";
import {CharPose} from "./Character";
import {CharacterId, Expression, Gesture} from "./types";

/* ------------------------------------------------------------------ shared */

const INK = NOTE.ink;
const YELLOW = DRAMA.title.band; // the channel's one accent (the title band, the winner's tile)
const PAPER_BG = "#F4EEE2"; // the lineup / notebook paper
const NIGHT = "#1B1E27"; // the fox's side: the dark call room

/** The banner's copy: the promise in plain words, tied to the name (생존노트 = notes on surviving), and the kinds of
 * scams the skits play (the small second line). */
export const TAGLINE = {
  main: "디지털 사기에서 살아남는 법",
  types: "보이스피싱 · 문자 사기 · 가짜 투자 광고",
} as const;

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

export type ChannelBannerProps = {types?: boolean; guides?: boolean};

export const BANNER = {w: 2560, h: 1440, safe: {w: 1546, h: 423}} as const;
const SX = (BANNER.w - BANNER.safe.w) / 2; // 507
const SY = Math.round((BANNER.h - BANNER.safe.h) / 2); // 509
/** Safe-area coordinates -> canvas. */
const X = (sx: number) => SX + sx;
const Y = (sy: number) => SY + sy;

/** The fox's side: a dark panel cut on a slant, right of `x0` at mid-height. */
const SLANT = {x0: X(1200), dx: 0.1};
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

/** The call screen colours: a generic dark incoming-call screen (no real phone maker's or carrier's look). */
const CALL = {bezel: "#17181C", screen: "#262C3A", text: "#FFFFFF", muted: "#C3CADA", avatar: "#4A5468",
  decline: TONES.danger.fill, accept: TONES.safe.fill};

/**
 * The phone 황 여사 holds up to the viewer: an invented incoming-call screen ("수신 전화", a "?" caller, "모르는 번호",
 * decline / accept buttons, ringing rings round the avatar), so "a call from an unknown number" reads with no text.
 */
const CallPhone: React.FC<{cx: number; cy: number; w: number; h: number; rotate: number}> = ({cx, cy, w, h, rotate}) => {
  const pad = 9;
  const btn = Math.round(w * 0.3);
  return (
    <div style={{position: "absolute", left: cx - w / 2, top: cy - h / 2, width: w, height: h,
      transform: `rotate(${rotate}deg)`, fontFamily: FONT}}>
      <div style={{position: "absolute", inset: 0, borderRadius: 34, background: CALL.bezel,
        boxShadow: `0 0 0 5px ${INK}, 0 18px 30px rgba(10,14,25,0.3)`}} />
      <div style={{position: "absolute", left: pad, top: pad, right: pad, bottom: pad, borderRadius: 26,
        background: CALL.screen, display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden"}}>
        <div style={{marginTop: 30, fontSize: 21, fontWeight: 700, color: CALL.muted, letterSpacing: 0}}>수신 전화</div>
        {/* the caller: a "?" avatar inside two faint ringing rings */}
        <div style={{marginTop: 16, width: 78, height: 78, borderRadius: "50%", background: CALL.avatar,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50, fontWeight: 900,
          color: CALL.text, lineHeight: 1, boxShadow: "0 0 0 9px rgba(255,255,255,0.12), 0 0 0 18px rgba(255,255,255,0.06)"}}>?</div>
        <div style={{marginTop: 14, fontSize: 30, fontWeight: 900, color: CALL.text, letterSpacing: -1,
          whiteSpace: "nowrap"}}>모르는 번호</div>
        <div style={{flex: 1}} />
        <div style={{marginBottom: 26, width: "100%", display: "flex", justifyContent: "space-evenly"}}>
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

/** 황 여사's paw over the phone's left edge (fur and ink of the animal cast's mother, two toe seams). */
const GripPaw: React.FC<{cx: number; cy: number}> = ({cx, cy}) => (
  <svg width={120} height={110} style={{position: "absolute", left: cx - 60, top: cy - 55, overflow: "visible"}}>
    <g transform="translate(60 55) rotate(-24)">
      <ellipse rx={40} ry={34} fill="#C69460" stroke={INK} strokeWidth={6.5} />
      <path d="M 14 -16 L 34 -16 M 14 0 L 38 0 M 14 16 L 34 16" stroke={INK} strokeWidth={4} strokeLinecap="round" />
    </g>
  </svg>
);

/** The fox's name tag: a stick-on badge (red header, white field) that says what he is, "사기꾼". */
const NameTag: React.FC<{cx: number; cy: number; text: string; rotate: number}> = ({cx, cy, text, rotate}) => {
  const w = 176;
  const h = 92;
  return (
    <div style={{position: "absolute", left: cx - w / 2, top: cy - h / 2, width: w, height: h, borderRadius: 14,
      background: NOTE.paper, overflow: "hidden", transform: `rotate(${rotate}deg)`, fontFamily: FONT,
      boxShadow: `0 0 0 4px ${INK}, 0 10px 18px rgba(0,0,0,0.35)`, display: "flex", flexDirection: "column"}}>
      <div style={{height: 24, background: TONES.danger.fill}} />
      <div style={{flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44,
        fontWeight: 900, color: INK, letterSpacing: -1, lineHeight: 1, whiteSpace: "nowrap"}}>{text}</div>
    </div>
  );
};

/** The family's survival cue: a small green round badge, a check over "생존" (the safe tone, no number). */
const SurvivedBadge: React.FC<{cx: number; cy: number; size: number}> = ({cx, cy, size}) => (
  <div style={{position: "absolute", left: cx - size / 2, top: cy - size / 2, width: size, height: size,
    borderRadius: "50%", background: TONES.safe.solid, boxShadow: `0 0 0 5px ${NOTE.paper}, 0 0 0 9px ${INK}, 0 10px 18px rgba(10,14,25,0.25)`,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
    transform: "rotate(-8deg)", fontFamily: FONT}}>
    <Check size={size * 0.42} color="#FFFFFF" strokeWidth={4} />
    <div style={{fontSize: size * 0.25, fontWeight: 900, color: "#FFFFFF", lineHeight: 1, letterSpacing: -0.5,
      marginTop: -2}}>생존</div>
  </div>
);

export const ChannelBanner: React.FC<ChannelBannerProps> = ({types = true, guides}) => {
  const W = BANNER.w;
  const H = BANNER.h;
  const card = {l: X(500), t: Y(64), w: 668, h: 300};
  const fox = {x: X(1380), eyeY: Y(160), k: 0.62};
  const phone = {cx: X(404), cy: Y(188), w: 184, h: 320, rotate: 6};
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
      {/* 진돗개네: 백 반장 behind, 황 여사 in front holding up the unknown call ("확인은 내가 직접 해") */}
      <Actor id="father" x={X(84)} eyeY={Y(176)} k={0.56} expr="smug" turn={0.3} tilt={3} look={[0.6, 0]}
        w={W} h={H} uid="bf" ink={1.15} />
      {/* her raised paw (palmOut) holds the phone up; the paw is drawn again over the phone's edge, the grip */}
      <Actor id="mother" x={X(244)} eyeY={Y(196)} k={0.64} expr="suspicious" gesture="palmOut" turn={0.25} tilt={-4}
        look={[0.8, -0.1]} w={W} h={H} uid="bm" ink={1.15} />
      <CallPhone {...phone} />
      <GripPaw cx={X(300)} cy={Y(334)} />
      {/* the survival medal pinned on her cardigan (over the other paw) */}
      <SurvivedBadge cx={X(200)} cy={Y(360)} size={104} />

      {/* 여 과장, caught: hand on head, sweating, a "사기꾼" name tag, under the stamp */}
      <Actor id="scammer" x={fox.x} eyeY={fox.eyeY} k={fox.k} expr="panicked" gesture="handOnHead" turn={-0.3}
        fx={["sweat2"]} look={[-0.5, 0.2]} w={W} h={H} uid="bx" rim="#EEE8DE" ink={1.15} tail />
      <NameTag cx={X(1298)} cy={Y(270)} text="사기꾼" rotate={-6} />
      <Stamp text="사기 실패" at={-30} x={X(1412)} y={Y(368)} rotate={-8}
        look={{shape: "box", font: 58, w: 252, h: 100}} />

      {/* the note card: the channel name, the promise under it, the kinds of scams */}
      <div style={{position: "absolute", left: card.l, top: card.t, width: card.w, height: card.h,
        filter: "drop-shadow(0 18px 28px rgba(10,14,25,0.22)) drop-shadow(0 2px 3px rgba(10,14,25,0.12))"}}>
        <div style={{position: "relative", width: "100%", height: "100%", background: NOTE.paper, borderRadius: NOTE.radius,
          border: `5px solid ${INK}`, boxSizing: "border-box", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, wordBreak: "keep-all", textAlign: "center"}}>
          <div style={{fontSize: 100, fontWeight: 900, color: INK, letterSpacing: -3, lineHeight: 1}}>디지털 생존노트</div>
          <div style={{fontSize: 48, fontWeight: 800, color: INK, letterSpacing: -1, lineHeight: 1.15, padding: "2px 16px",
            background: `linear-gradient(transparent 52%, ${YELLOW} 52%, ${YELLOW} 92%, transparent 92%)`}}>{TAGLINE.main}</div>
          {types ? (
            <div style={{fontSize: 30, fontWeight: 700, color: "#4A4F5C", letterSpacing: -0.5, lineHeight: 1}}>
              {TAGLINE.types}</div>
          ) : null}
        </div>
      </div>

      {/* 도치, the silent alarm: small, on the card's corner, spikes up, eyes on the fox */}
      <div style={{position: "absolute", left: 0, top: 0}}>
        <Dochi pose={dochiPose(card.l + card.w - 70, card.t + 8, 84, {expr: "alarmed", bristle: 1, lookX: 1,
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

