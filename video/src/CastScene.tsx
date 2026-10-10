// Drama stagings: the dialogue scenes played by characters instead of a full-screen phone mockup. Each staging cuts
// between a few framings (composition.json "stagings_spec": extreme close-up, close-up, bust behind a foreground
// prop, full figure on the floor) on the line starts, with a slow push-in inside each shot, a punch-in on the scene's
// keyword and a camera shake on shocked lines; the twist cuts to the victim's shocked extreme close-up, flashes,
// desaturates the room and freezes under the stamp.
// The existing mockups stay where they carry information: the chat/SMS thread floats above the phone in the hand,
// the ad plays on the TV, the explainer cards sit smaller beside the family in dochi_explains.
import React, {useMemo} from "react";
import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {Phone} from "lucide-react";
import {Character} from "./Actor";
import {CharPose, Fx, INK} from "./Character";
import {lineLevel, useCast, useSpeechMs, Waveform} from "./dialogue";
import {clamp, useShell} from "./kit";
import {fadeOut, SceneContext, spr, useRealFrame, useScene} from "./motion";
import {actingAt, adOf, blinkAt, bubbleOf, callerOf, CharSpot, MOTION, neckY, RIG, otherOf, planShots, punchZoom,
  shockShake, shotAt, shotSpec, SPEC, speakerAt, strSeed, talkWeight, twistCutMs, victimOf, Who} from "./rig";
import {CallCentreSet, FocusLines, ForegroundProp, HomeSet, HomeVariant, PropKind, SetMode} from "./Sets";
import {FONT} from "./fonts";
import {isLight, NOTE, TONES, useTheme} from "./themes";
import {CastMember, CharacterId, Expression, Gesture, SceneProps, Staging} from "./types";

const RIM = "#EEE8DE";
/** The opening scene keeps its first shot (the victim's face, the poster) this long; watch_ad cuts to the TV sooner
 * (the ad speaks first and its close-up is the scene's hook). */
export const POSTER_HOLD_MS = 1500;
const posterHold = (staging: Staging) => (staging === "watch_ad" ? 700 : POSTER_HOLD_MS);

type Ctx = {
  scene: SceneProps; cast: Record<string, CastMember>; staging: Staging; mode: SetMode;
  ms: number; // speech clock
  msA: number; // acting clock: stops a moment after the twist stamp lands (the freeze)
  frame: number; // visual frame
  frameA: number; // visual frame, frozen with msA
  fps: number; index: number;
  shake: number; // camera shake (screen px) of a shocked line
  victim?: string; caller?: string; other?: string; ad?: string;
};

const exprFx = (e: Expression, since: number, who: Who): Fx[] => {
  switch (e) {
    case "worried": return ["sweat"];
    case "shocked": return ["shockLines", "sweat", "sweat2", "gloom"];
    case "panicked": return ["tears", "sweat"];
    case "relieved": return since < 45 ? ["blush", "puff"] : ["blush"];
    case "suspicious": return who === "victim" || who === "other" ? ["question"] : [];
    case "excited": return ["sparkle", "blush"];
    default: return [];
  }
};

type PoseOpts = {gesture?: Gesture; look?: [number, number]; force?: Expression; fx?: Fx[]; glow?: CharPose["glow"];
  tilt?: number; mirror?: boolean; screen?: CharPose["screen"]; rim?: string | null; free?: Gesture; dx?: number;
  dy?: number; shadowHalf?: number; monitor?: number; noIdle?: boolean; px?: number};

/** A character's pose at this moment: the spot of the shot + the acting (rig.actingAt) + idle life. */
const poseOf = (c: Ctx, spot: CharSpot, id: string | undefined, who: Who, o: PoseOpts = {}): CharPose => {
  const character: CharacterId = (id ? c.cast[id]?.character : undefined) ?? (who === "presenter" ? "ad" : "father");
  const base = (o.gesture ?? spot.gestures[0] ?? "rest") as Gesture;
  const act = actingAt(c.scene, c.cast, id, who, c.staging, c.msA, base);
  const exprAt = (ms: number) => o.force ?? actingAt(c.scene, c.cast, id, who, c.staging, ms, base).expr;
  const expr = o.force ?? act.expr;
  // frames since the expression changed (reaction squash, shock shake)
  let since = 99;
  for (let j = 1; j <= 10; j++) {
    if (exprAt(c.msA - (j * 1000) / c.fps) !== expr) {
      since = j - 1;
      break;
    }
  }
  const seed = strSeed(`${id ?? who}${character}`);
  const t = c.frameA / c.fps;
  // a 4-frame squash when the face changes; a listener's head shakes ~8 px on screen when it turns shocked (the
  // speaker's shocked line shakes the camera instead)
  const squash = since < MOTION.squash.length ? MOTION.squash[since] : 1;
  const shake = expr === "shocked" && !act.talking && since < 8 ? Math.sin(since * 2.7) * (8 / spot.k) * (1 - since / 8) : 0;
  // listening nod: a small nod as the other side's line ends
  const lines = c.scene.lines ?? [];
  const ended = lines.find((l) => l.speaker !== id && c.msA >= l.endMs && c.msA < l.endMs + 320);
  const nod = act.talking ? 1.6 * Math.sin(c.frameA * 0.55)
    : ended ? 3.5 * Math.sin((Math.PI * (c.msA - ended.endMs)) / 320) : 0;
  const idle = o.noIdle ? 0 : 1.5 * Math.sin(2 * Math.PI * 0.2 * t + seed);
  return {
    id: character, x: spot.x + (o.dx ?? 0), y: neckY(spot.eyeY, spot.k) + (o.dy ?? 0), k: spot.k, px: o.px,
    view: spot.view === "back" ? "back" : "front", turn: spot.turn ?? 0, tilt: (o.tilt ?? 0) + idle, nod,
    breathe: o.noIdle ? 0 : Math.sin(2 * Math.PI * 0.25 * t + seed), expr, mouth: act.mouth, talking: act.talking,
    look: o.look ?? [0, 0], blink: blinkAt(c.frameA, seed, c.fps),
    gesture: o.gesture && act.gesture === base ? o.gesture : act.gesture, free: o.free, mirror: o.mirror,
    typing: c.frameA, fx: o.fx ?? exprFx(expr, since, who), squash, shake,
    rim: o.rim === null ? undefined : o.rim ?? (c.mode === "dark" ? RIM : undefined), rimWidth: 7,
    glow: o.glow, screen: o.screen, shadowHalf: o.shadowHalf, monitor: o.monitor,
  };
};

/** Slow push-in inside a shot (2-4%), centred on the main face. */
const pushIn = (c: Ctx, startMs: number, endMs: number) => {
  const startEff = Math.max(startMs, -((shiftOf(c) / c.fps) * 1000));
  const endEff = Math.min(endMs, c.scene.durationMs);
  const dur = Math.max(1200, endEff - startEff);
  const p = Math.min(1, Math.max(0, (c.msA - startEff) / dur));
  return 1 + 0.035 * (p * p * (3 - 2 * p));
};
const shiftOf = (c: Ctx) => c.frame - (c.ms / 1000) * c.fps;

/** The foreground prop of a shot (composition.json shot "prop"), drawn in front of the characters. */
const Prop: React.FC<{c: Ctx; spec: {prop?: {kind: string; top: number}}}> = ({c, spec}) =>
  spec.prop ? <ForegroundProp kind={spec.prop.kind as PropKind} top={spec.prop.top} mode={c.mode} /> : null;

const Camera: React.FC<{zoom: number; fx: number; fy: number; shake?: number; children: React.ReactNode;
  filter?: string}> = ({zoom, fx, fy, shake = 0, children, filter}) => (
  <div style={{position: "absolute", inset: 0, transform: `translate(${shake}px, ${shake * 0.4}px) scale(${zoom})`,
    transformOrigin: `${fx}px ${fy}px`, filter}}>
    {children}
  </div>
);

/** Keyword bubble (<= 8 chars) near the speaker, tail toward them; the scammer's words in the danger ink. */
const Bubble: React.FC<{text: string; x: number; y: number; tail: "left" | "right" | "up" | "down"; danger: boolean;
  fromF: number; toF: number; frame: number}> = ({text, x, y, tail, danger, fromF, toF, frame}) => {
  const s = spr(frame, fromF, 10, 0.06);
  const out = interpolate(frame, [toF, toF + 6], [1, 0], clamp);
  if (s <= 0 || out <= 0) return null;
  const tailStyle: React.CSSProperties = tail === "down" ? {left: "38%", bottom: -26}
    : tail === "up" ? {left: "55%", top: -26, transform: "rotate(180deg)"}
    : tail === "left" ? {left: -30, top: "40%", transform: "rotate(90deg)"} : {right: -30, top: "40%", transform: "rotate(-90deg)"};
  return (
    <div style={{position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${0.6 + 0.4 * s})`,
      opacity: Math.min(1, s * 1.4) * out}}>
      <div style={{position: "relative", padding: "12px 28px 14px", borderRadius: 32, background: NOTE.paper,
        border: `5px solid ${INK}`, fontFamily: FONT, fontWeight: 900, fontSize: 46, lineHeight: 1.1,
        color: danger ? TONES.danger.ink : NOTE.ink, whiteSpace: "nowrap", boxShadow: "0 10px 22px rgba(0,0,0,0.25)"}}>
        {text}
        <svg width={40} height={30} style={{position: "absolute", ...tailStyle}}>
          <path d="M 2 2 L 38 2 L 14 28 Z" fill={NOTE.paper} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <rect x={4} y={0} width={32} height={6} fill={NOTE.paper} />
        </svg>
      </div>
    </div>
  );
};

/** Bubbles of the scene's lines that have one: `place(speaker)` gives where (or null = none in this shot). */
const Bubbles: React.FC<{c: Ctx; place: (speaker: string) => {x: number; y: number; tail: "left" | "right" | "up" |
  "down"} | null}> = ({c, place}) => {
  const lines = c.scene.lines ?? [];
  const toF = (ms: number) => (ms / 1000) * c.fps + shiftOf(c);
  return (
    <>
      {lines.map((l, i) => {
        const text = bubbleOf(l);
        const at = place(l.speaker);
        if (!text || !at || c.ms < l.startMs - 100 || c.ms > l.endMs + 400) return null;
        return <Bubble key={i} text={text} {...at} danger={c.cast[l.speaker]?.role === "scammer"} fromF={toF(l.startMs)}
          toF={toF(l.endMs)} frame={c.frame} />;
      })}
    </>
  );
};

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The caller in a framed inset (dark office); scale/brightness follow who is talking. */
const CallerWindow: React.FC<{c: Ctx; box: {x: number; y: number; w: number; h: number; scale: number}}> = ({c,
  box}) => {
  const id = c.caller;
  const w = talkWeight(c.scene, id, c.msA);
  const enter = c.index === 0 ? 1 : spr(c.frame, 3, 12, 0.04);
  const s = box.scale * (0.94 + 0.06 * w) * (0.7 + 0.3 * enter);
  const spot = {...SPEC.pip_call.windowChar, who: "caller" as Who, gestures: ["rest"], turn: -0.25};
  const fake = id ? c.cast[id]?.character === "fake_banker" : false;
  const pose = poseOf(c, spot, id, "caller", {look: [-0.6, 0.1], rim: "#5FD3C8", monitor: 1,
    shadowHalf: fake ? 1 : 0, px: spot.k * s});
  const level = id ? (c.scene.lines ?? []).reduce((m, l) => (l.speaker === id ? Math.max(m, lineLevel(l, c.ms)) : m), 0) : 0;
  const seconds = 3 + Math.max(0, c.ms - c.scene.leadInMs) / 1000;
  return (
    <div style={{position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h,
      transform: `scale(${s})`, transformOrigin: "100% 0%", opacity: Math.min(1, enter * 1.5),
      filter: `brightness(${0.8 + 0.2 * w})`}}>
      <div style={{position: "absolute", inset: 0, borderRadius: 34, overflow: "hidden", background: "#0C1017",
        border: `5px solid ${TONES.danger.fill}`, boxShadow: "0 18px 44px rgba(0,0,0,0.45)"}}>
        <CallCentreSet w={box.w} h={box.h} frame={c.frameA} />
        <Character pose={pose} uid={`cw${c.index}`} box={{w: box.w, h: box.h}} frame={c.frameA} />
        <div style={{position: "absolute", left: 0, right: 0, bottom: 0, height: 84, background: "rgba(8,10,14,0.82)",
          display: "flex", alignItems: "center", gap: 14, padding: "0 20px", fontFamily: FONT}}>
          <div style={{width: 48, height: 48, borderRadius: "50%", background: TONES.danger.solid, display: "flex",
            alignItems: "center", justifyContent: "center", flex: "0 0 auto"}}>
            <Phone size={26} color="#fff" strokeWidth={2.6} />
          </div>
          <div style={{display: "flex", flexDirection: "column", minWidth: 0, flex: 1}}>
            <div style={{fontSize: 32, fontWeight: 800, color: "#F3F6FB", whiteSpace: "nowrap", overflow: "hidden",
              textOverflow: "ellipsis", lineHeight: 1.1}}>{c.scene.caller ?? "알 수 없음"}</div>
            <div style={{fontSize: 22, fontWeight: 700, color: "rgba(243,246,251,0.7)", fontVariantNumeric: "tabular-nums"}}>
              통화 중 {clock(seconds)}
            </div>
          </div>
          <Waveform level={level} color="#5FD3C8" height={40} bars={5} width={7} />
        </div>
      </div>
    </div>
  );
};

/** The victim's phone-screen colours (the back of the hand-held phone in the over-shoulder shot). */
const SCREEN = {bg: "#1B2233", rows: ["#3A4560", "#5B63F0", "#3A4560", "#5B63F0"]};

/* ------------------------------------------------------------------ the twist close-up (all stagings) */

const TwistShot: React.FC<{c: Ctx; variant: HomeVariant}> = ({c, variant}) => {
  const spot = SPEC.twist_closeup.shots.twist.chars[0] as CharSpot;
  const at = c.scene.twist ? c.scene.twist.atMs : 1e9;
  const hit = ((c.ms - at) / 1000) * c.fps;
  const cut = ((c.ms - twistCutMs(c.scene)) / 1000) * c.fps;
  const k = hit >= 0 ? Math.min(1, (hit + 1) / 3) : 0;
  const flash = hit < 0 ? 0 : hit < 2 ? 0.85 : Math.max(0, 0.85 * (1 - (hit - 2) / 5));
  const shake = hit >= 0 && hit < 8 ? Math.sin(hit * 2.7) * 6 * (1 - hit / 8) : 0;
  const zoom = 0.965 + 0.035 * Math.min(1, spr(cut, 0, 8, 0.02));
  const pose = poseOf(c, spot, c.victim, "victim", {force: "shocked", gesture: "handsOnCheeks", look: [0, 0],
    fx: hit >= 0 ? ["shockLines", "sweat", "sweat2", "gloom"] : ["sweat", "shockLines"], noIdle: hit >= 0});
  const focus = c.mode === "dark" ? "#EEE8DE" : "#2B2620";
  return (
    <>
      <Camera zoom={zoom} fx={spot.x} fy={spot.eyeY} shake={shake}>
        <div style={{position: "absolute", inset: 0, filter: `grayscale(${k}) brightness(${1 - 0.15 * k})`}}>
          <HomeSet mode={c.mode} variant={variant} />
        </div>
        <FocusLines cx={spot.x} cy={spot.eyeY} color={focus} opacity={0.32 * k} />
        <Character pose={pose} uid={`tw${c.index}`} frame={c.frameA} />
        <div style={{position: "absolute", inset: 0, filter: `grayscale(${k}) brightness(${1 - 0.15 * k})`}}>
          <Prop c={c} spec={SPEC.twist_closeup.shots.twist} />
        </div>
      </Camera>
      <div style={{position: "absolute", inset: 0, background: "#fff", opacity: flash}} />
    </>
  );
};

/* ------------------------------------------------------------------ stagings */

const PipCall: React.FC<{c: Ctx; shot: string; zoom: number}> = ({c, shot, zoom}) => {
  const spec = shotSpec("pip_call", shot) as {chars: CharSpot[]; window?: {x: number; y: number; w: number; h: number;
    scale: number}; prop?: {kind: string; top: number}};
  const callerTalks = talkWeight(c.scene, c.caller, c.msA) > 0.5;
  if (shot === "other") return <Solo c={c} shot="other" zoom={zoom} variant="living" />;
  if (shot === "caller") {
    const spot = spec.chars[0];
    const fake = c.caller ? c.cast[c.caller]?.character === "fake_banker" : false;
    const pose = poseOf(c, spot, c.caller, "caller", {look: [-0.3, 0.2], rim: "#5FD3C8", monitor: 1,
      shadowHalf: fake ? 1 : 0});
    return (
      <>
        <Camera zoom={zoom} shake={c.shake} fx={spot.x} fy={spot.eyeY}>
          <CallCentreSet w={1080} h={1920} frame={c.frameA} />
          <Character pose={pose} uid={`pc${c.index}`} frame={c.frameA} />
          <Prop c={c} spec={spec} />
        </Camera>
        <Bubbles c={c} place={(s) => (s === c.caller ? {x: 300, y: 330, tail: "down"} : null)} />
      </>
    );
  }
  const spot = spec.chars[0];
  const act = actingAt(c.scene, c.cast, c.victim, "victim", "pip_call", c.msA, "phoneEar");
  const strong = act.expr === "shocked" || act.expr === "panicked";
  // the free hand clutches the chest only where the paws are in the picture (the full shot)
  const full = (spec as {size?: string}).size === "full";
  const pose = poseOf(c, spot, c.victim, "victim", {gesture: "phoneEar", free: strong && full ? "clutchChest" : undefined,
    look: callerTalks ? [0.7, -0.55] : [0.35, -0.2]});
  const b = SPEC.pip_call.bubble;
  return (
    <>
      <Camera zoom={zoom} shake={c.shake} fx={spot.x} fy={full ? spot.eyeY + 300 * spot.k : spot.eyeY}>
        <HomeSet mode={c.mode} variant="living" />
        <Character pose={pose} uid={`pv${c.index}`} frame={c.frameA}
          style={{filter: callerTalks ? "brightness(0.9)" : undefined}} />
        <Prop c={c} spec={spec} />
      </Camera>
      {spec.window ? <CallerWindow c={c} box={spec.window} /> : null}
      <Bubbles c={c} place={(s) => (s === c.caller ? {x: b.caller[0], y: b.caller[1], tail: "up"}
        : s === c.victim ? {x: b.victim[0], y: b.victim[1], tail: "down"} : null)} />
    </>
  );
};

const SplitCall: React.FC<{c: Ctx; zoom: number}> = ({c, zoom}) => {
  const spec = shotSpec("split_call", "split");
  const [top, bottom] = spec.chars;
  const border = SPEC.split_call.border;
  const dy = Math.tan((border.tilt * Math.PI) / 180) * 540;
  const fake = c.caller ? c.cast[c.caller]?.character === "fake_banker" : false;
  const callerPose = poseOf(c, top, c.caller, "caller", {look: [0, 0.2], rim: "#5FD3C8", monitor: 1,
    shadowHalf: fake ? 1 : 0});
  const victimPose = poseOf(c, bottom, c.victim, "victim", {gesture: "phoneEar", look: [0.4, -0.6]});
  const speaker = speakerAt(c.scene, c.msA);
  const level = (c.scene.lines ?? []).reduce((m, l) => Math.max(m, lineLevel(l, c.ms)), 0);
  return (
    <>
      <div style={{position: "absolute", inset: 0, clipPath: `polygon(0 236px, 100% 236px, 100% ${border.y - dy}px, 0 ${border.y + dy}px)`}}>
        <Camera zoom={zoom} shake={c.shake} fx={top.x} fy={top.eyeY}>
          <CallCentreSet w={1080} h={1100} frame={c.frameA} />
          <Character pose={callerPose} uid={`sc${c.index}`} frame={c.frameA}
            style={{filter: speaker === c.caller ? undefined : "brightness(0.82)"}} />
        </Camera>
      </div>
      <div style={{position: "absolute", inset: 0, clipPath: `polygon(0 ${border.y + dy + 8}px, 100% ${border.y - dy + 8}px, 100% 100%, 0 100%)`}}>
        <Camera zoom={zoom} shake={c.shake} fx={bottom.x} fy={bottom.eyeY}>
          <HomeSet mode={c.mode} variant="living" floor={1500} />
          <Character pose={victimPose} uid={`sv${c.index}`} frame={c.frameA}
            style={{filter: speaker === c.victim ? undefined : "brightness(0.9)"}} />
          <Prop c={c} spec={spec as {prop?: {kind: string; top: number}}} />
        </Camera>
      </div>
      <svg width={1080} height={1920} style={{position: "absolute", inset: 0}}>
        <path d={`M 0 ${border.y + dy + 4} L 1080 ${border.y - dy + 4}`} stroke={INK} strokeWidth={10} />
        <path d={`M 0 ${border.y + dy + 4} L 1080 ${border.y - dy + 4}`} stroke={NOTE.paper} strokeWidth={4} />
      </svg>
      <div style={{position: "absolute", left: 540 - 60, top: border.y - 40, width: 120, height: 80, borderRadius: 40,
        background: NOTE.paper, border: `5px solid ${INK}`, display: "flex", alignItems: "center", justifyContent: "center"}}>
        <Waveform level={level} color={speaker === c.caller ? TONES.danger.fill : "#3A3F4B"} height={46} bars={5} width={8} />
      </div>
    </>
  );
};

const Solo: React.FC<{c: Ctx; shot: string; zoom: number; variant?: HomeVariant}> = ({c, shot, zoom, variant}) => {
  const soloSpec = shotSpec("solo", shot) as {chars: CharSpot[]; prop?: {kind: string; top: number}};
  const spot = soloSpec.chars[0];
  if (shot === "caller") {
    const fake = c.caller ? c.cast[c.caller]?.character === "fake_banker" : false;
    const pose = poseOf(c, spot, c.caller, "caller", {rim: "#5FD3C8", monitor: 1, shadowHalf: fake ? 1 : 0,
      look: [-0.2, 0.1]});
    return (
      <Camera zoom={zoom} shake={c.shake} fx={spot.x} fy={spot.eyeY}>
        <CallCentreSet w={1080} h={1920} frame={c.frameA} />
        <Character pose={pose} uid={`oc${c.index}`} frame={c.frameA} />
        <Prop c={c} spec={soloSpec} />
      </Camera>
    );
  }
  const id = shot === "other" ? c.other : c.victim;
  const pose = poseOf(c, spot, id, shot === "other" ? "other" : "victim", {gesture: c.scene.layout === "call" ? "phoneEar"
    : "phoneRead", look: [0.2, -0.1]});
  const set = variant ?? (shot === "other" ? "work" : "living");
  // a family member in the victim's room (pip_call "other") stands behind the home's table, not an office desk
  const prop = soloSpec.prop && set !== "work" ? {...soloSpec.prop, kind: "table"} : soloSpec.prop;
  return (
    <Camera zoom={zoom} shake={c.shake} fx={spot.x} fy={spot.eyeY}>
      <HomeSet mode={c.mode} variant={set} />
      <Character pose={pose} uid={`ov${c.index}`} frame={c.frameA} />
      <Prop c={c} spec={{prop}} />
    </Camera>
  );
};

/** The phone's thread, floating up out of the phone in the hand (over_shoulder_chat). */
const FloatingPanel: React.FC<{c: Ctx; body: React.ReactNode}> = ({c, body}) => {
  const spec = (SPEC.over_shoulder_chat.shots.over as unknown as {panel: {x: number; y: number; scale: number}}).panel;
  const over = SPEC.over_shoulder_chat.shots.over.chars[0] as CharSpot;
  const phone = {x: over.x + RIG.back.phone[0] * over.k, y: neckY(over.eyeY, over.k) + RIG.back.phone[1] * over.k};
  const e = c.index === 0 ? 1 : spr(c.frame, 2, 14, 0.03);
  const s = spec.scale * (0.22 + 0.78 * e);
  // the panel's natural box: x 110..970, y 530..1200 (kit BODY / PhonePanel)
  const natural = {x: 110, y: 530, w: 860, h: 670};
  const tx = spec.x + (phone.x - (spec.x + (natural.w * spec.scale) / 2)) * (1 - e);
  const ty = spec.y + (phone.y - (spec.y + (natural.h * spec.scale) / 2)) * (1 - e);
  const left = tx - natural.x * s;
  const top = ty - natural.y * s;
  const pw = natural.w * s;
  const ph = natural.h * s;
  return (
    <>
      {/* the callout: two faint lines from the phone to the panel's lower corners */}
      <svg width={1080} height={1920} style={{position: "absolute", inset: 0, opacity: 0.35 * e}}>
        <path d={`M ${phone.x - 50} ${phone.y - 90} L ${tx} ${ty + ph} M ${phone.x + 50} ${phone.y - 90} L ${tx + pw} ${ty + ph}`}
          stroke={c.mode === "dark" ? "#DDF3FF" : INK} strokeWidth={3} strokeDasharray="10 10" />
      </svg>
      <div style={{position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transformOrigin: "0 0",
        transform: `translate(${left}px, ${top}px) scale(${s})`, opacity: Math.min(1, e * 1.6)}}>
        {body}
      </div>
    </>
  );
};

const OverShoulder: React.FC<{c: Ctx; shot: string; zoom: number; body: React.ReactNode}> = ({c, shot, zoom, body}) => {
  const osSpec = shotSpec("over_shoulder_chat", shot) as {chars: CharSpot[]; prop?: {kind: string; top: number}};
  const spot = osSpec.chars[0];
  if (shot === "over") {
    const pose = poseOf(c, spot, c.victim, "victim", {screen: SCREEN, look: [0, 0]});
    return (
      <>
        <Camera zoom={zoom} shake={c.shake} fx={540} fy={760}>
          <HomeSet mode={c.mode} variant="living" />
          <Character pose={pose} uid={`ob${c.index}`} frame={c.frameA} />
          <Prop c={c} spec={osSpec} />
        </Camera>
        <FloatingPanel c={c} body={body} />
      </>
    );
  }
  if (shot === "caller") {
    const pose = poseOf(c, spot, c.caller, "caller", {gesture: "phoneType", rim: "#5FD3C8", monitor: 1,
      look: [0, 0.5], tilt: 6});
    return (
      <>
        <Camera zoom={zoom} shake={c.shake} fx={spot.x} fy={spot.eyeY}>
          <CallCentreSet w={1080} h={1920} frame={c.frameA} />
          <Character pose={pose} uid={`oc${c.index}`} frame={c.frameA} />
          <Prop c={c} spec={osSpec} />
        </Camera>
        <Bubbles c={c} place={(s) => (s === c.caller ? {x: 300, y: 330, tail: "down"} : null)} />
      </>
    );
  }
  const other = shot === "other";
  const id = other ? c.other : c.victim;
  const talking = talkWeight(c.scene, id, c.msA) > 0.5;
  const pose = poseOf(c, spot, id, other ? "other" : "victim", {gesture: talking ? "phoneType" : "phoneRead",
    look: talking ? [0, 0.15] : [0, 0.65], tilt: talking ? 2 : 7, glow: {color: "#CFE8FF", amount: 0.3, from: "below"}});
  return (
    <>
      <Camera zoom={zoom} shake={c.shake} fx={spot.x} fy={spot.eyeY}>
        <HomeSet mode={c.mode} variant={other ? "work" : "living"} />
        <Character pose={pose} uid={`of${c.index}`} frame={c.frameA} />
        <Prop c={c} spec={osSpec} />
      </Camera>
      <Bubbles c={c} place={(s) => (s === id ? {x: other ? 790 : 290, y: 330, tail: "down"} : null)} />
    </>
  );
};

/** The ad on the TV: an invented presenter (never a real person) pointing at a rising line, a "광고" tag. */
const AdScreen: React.FC<{c: Ctx; w: number; h: number}> = ({c, w, h}) => {
  const p = SPEC.watch_ad.presenter;
  const k = h * p.kFrac;
  const spot: CharSpot = {who: "presenter", x: w * 0.3, eyeY: h * p.eyeYFrac, k, turn: 0.2, gestures: ["rest"]};
  const talking = talkWeight(c.scene, c.ad, c.msA) > 0.5;
  const pose = poseOf(c, spot, c.ad, "presenter", {gesture: talking ? "point" : "rest", look: [0.5, 0], rim: null});
  const g = c.frameA % 46;
  const glitch = g < 3; // a short deepfake shimmer now and then
  const draw = Math.min(1, Math.max(0, (c.frameA - 4) / 40));
  const pts: [number, number][] = [[0.52, 0.78], [0.6, 0.7], [0.67, 0.74], [0.75, 0.55], [0.83, 0.6], [0.93, 0.3]];
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x * w} ${y * h}`).join(" ");
  const line = c.scene.lines?.find((l) => l.speaker === c.ad);
  const ticker = bubbleOf(line);
  return (
    <div style={{position: "absolute", inset: 0, overflow: "hidden", background: "linear-gradient(160deg, #20385A 0%, #2B6876 100%)"}}>
      <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0}}>
        {[0.3, 0.45, 0.6, 0.75].map((y) => <path key={y} d={`M ${0.5 * w} ${y * h} H ${0.97 * w}`} stroke="#fff"
          strokeOpacity={0.1} strokeWidth={2} />)}
        <path d={d} stroke="#F2C14E" strokeWidth={Math.max(5, h * 0.022)} fill="none" strokeLinecap="round"
          strokeLinejoin="round" pathLength={1} strokeDasharray={`${draw} 1`} />
        {draw > 0.95 ? <path d={`M ${0.93 * w} ${0.3 * h} l ${-h * 0.06} ${h * 0.01} M ${0.93 * w} ${0.3 * h}
          l ${-h * 0.01} ${h * 0.06}`} stroke="#F2C14E" strokeWidth={Math.max(5, h * 0.022)} strokeLinecap="round" /> : null}
      </svg>
      <div style={{position: "absolute", inset: 0, transform: glitch ? `translateX(${g === 1 ? 7 : -5}px)` : undefined}}>
        <Character pose={pose} uid={`ad${c.index}${w}`} box={{w, h}} frame={c.frameA} />
      </div>
      {glitch ? (
        <>
          <div style={{position: "absolute", left: 0, right: 0, top: h * 0.22, height: h * 0.05, background: "#5FD3C8",
            opacity: 0.25, transform: "translateX(10px)"}} />
          <div style={{position: "absolute", left: 0, right: 0, top: h * 0.36, height: h * 0.03, background: "#D7A8E8",
            opacity: 0.22, transform: "translateX(-8px)"}} />
        </>
      ) : null}
      <div style={{position: "absolute", left: h * 0.04, top: h * 0.04, padding: `${h * 0.008}px ${h * 0.03}px`,
        borderRadius: 999, background: "#FFD23F", color: "#17181C", fontFamily: FONT, fontWeight: 900,
        fontSize: Math.max(18, h * 0.06)}}>광고</div>
      {ticker ? (
        <div style={{position: "absolute", left: 0, right: 0, bottom: 0, height: h * 0.17, background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 900,
          fontSize: h * 0.085, color: "#fff", whiteSpace: "nowrap"}}>{ticker}</div>
      ) : null}
    </div>
  );
};

const Tv: React.FC<{c: Ctx; box: {x: number; y: number; w: number; h: number}}> = ({c, box}) => (
  <div style={{position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h}}>
    <div style={{position: "absolute", left: box.w * 0.3, right: box.w * 0.3, bottom: -34, height: 40, background: "#15181E",
      border: `5px solid ${INK}`, borderTop: "none", borderRadius: "0 0 16px 16px"}} />
    <div style={{position: "absolute", inset: 0, borderRadius: 26, background: "#15181E", border: `6px solid ${INK}`,
      boxShadow: "0 0 80px rgba(120,200,230,0.28), 0 20px 40px rgba(0,0,0,0.35)"}}>
      <div style={{position: "absolute", inset: 14, borderRadius: 14, overflow: "hidden"}}>
        <AdScreen c={c} w={box.w - 40} h={box.h - 40} />
      </div>
    </div>
  </div>
);

const WatchAd: React.FC<{c: Ctx; shot: string; zoom: number}> = ({c, shot, zoom}) => {
  const spec = shotSpec("watch_ad", shot) as {chars: CharSpot[]; tv?: {x: number; y: number; w: number; h: number};
    prop?: {kind: string; top: number}};
  if (shot === "tv") {
    return (
      <Camera zoom={zoom} shake={c.shake} fx={540} fy={660}>
        <HomeSet mode={c.mode} variant="living" dim={0.7} />
        {spec.tv ? <Tv c={c} box={spec.tv} /> : null}
      </Camera>
    );
  }
  const spot = spec.chars[0];
  const act = actingAt(c.scene, c.cast, c.victim, "victim", "watch_ad", c.msA, "rest");
  const pointing = act.talking && act.expr === "excited" && shot === "wide";
  const pose = poseOf(c, spot, c.victim, "victim", {gesture: pointing ? "point" : "rest", mirror: pointing,
    look: [-0.8, -0.5], glow: {color: "#8FD3FF", amount: 0.32, from: "left"}});
  const sofa = c.mode === "dark" ? {fill: "#3A3029", line: "#2A221D"} : {fill: "#C9B89C", line: INK};
  return (
    <Camera zoom={zoom} shake={c.shake} fx={spot.x} fy={spot.eyeY}>
      <HomeSet mode={c.mode} variant="sofa" />
      {spec.tv ? <Tv c={c} box={spec.tv} /> : null}
      {/* the sofa back behind the victim */}
      <svg width={1080} height={1920} style={{position: "absolute", inset: 0}}>
        <path d={`M ${spot.x - 330 * spot.k} 1920 L ${spot.x - 330 * spot.k} ${1120 + (spot.eyeY - 830)} Q ${spot.x - 330 * spot.k}
          ${1060 + (spot.eyeY - 830)} ${spot.x - 270 * spot.k} ${1060 + (spot.eyeY - 830)} L 1100 ${1060 + (spot.eyeY - 830)} L 1100 1920 Z`}
          fill={sofa.fill} fillOpacity={c.mode === "dark" ? 1 : 0.35} stroke={sofa.line} strokeOpacity={c.mode === "dark" ? 1 : 0.5}
          strokeWidth={5} />
      </svg>
      <Character pose={pose} uid={`wa${c.index}`} frame={c.frameA} />
      <Prop c={c} spec={spec} />
    </Camera>
  );
};

/** dochi_explains: the explainer's cards smaller at the right, the victim listening at the left, 도치 in front. */
const DochiExplains: React.FC<{c: Ctx; body: React.ReactNode}> = ({c, body}) => {
  const spec = SPEC.dochi_explains;
  const spot = spec.shots.explain.chars[0] as CharSpot;
  const ctx = useScene();
  const speech = Math.max(1, c.scene.leadInMs + c.scene.speechMs);
  const p = c.msA / speech;
  const accent = c.scene.accent;
  let force: Expression | undefined;
  let gesture: Gesture = "rest";
  if (ctx.last && p > 0.55) {
    force = "relieved";
    gesture = "clutchChest";
  } else if (accent === "red" && p > 0.3) {
    force = "worried";
    gesture = p < 0.75 ? "handOnHead" : "rest";
  } else if (accent === "yellow") {
    force = p > 0.25 ? "worried" : "neutral";
  } else if (accent === "green" && p > 0.45) {
    force = "relieved";
    gesture = "clutchChest";
  } else {
    force = "neutral";
  }
  const pose = poseOf(c, spot, c.victim, "victim", {force, gesture, look: [0.85, 0.35]});
  const shell = useShell("fade");
  const content = spec.content;
  return (
    <>
      <div style={{position: "absolute", inset: 0, ...shell}}>
        <HomeSet mode={c.mode} variant="living" dim={0.55} />
        <Character pose={pose} uid={`de${c.index}`} frame={c.frameA} />
      </div>
      <div style={{position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transformOrigin: "0 0",
        transform: `translate(${content.x}px, ${content.y}px) scale(${content.scale})`}}>
        <SceneContext.Provider value={{...ctx, mascot: false}}>{body}</SceneContext.Provider>
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ the scene */

/**
 * A dialogue scene staged with characters. `body` = the layout's own picture (the chat/SMS thread for
 * over_shoulder_chat, the explainer for dochi_explains; unused by the others).
 */
export const CastScene: React.FC<{scene: SceneProps; staging: Staging; body: React.ReactNode}> = ({scene, staging,
  body}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cast = useCast();
  const theme = useTheme();
  const ms = useSpeechMs();
  const s = useScene();
  const shell = useShell("fade");
  // a drama scene cuts in (no fade-in): two half-transparent scenes would let the stage's page flash through
  const realFrame = useRealFrame();
  const exit = s.mode === "continuity" && !s.last ? fadeOut(realFrame, s.frames)
    : interpolate(realFrame, [s.frames - 7, s.frames], [1, 0], clamp);
  const shots = useMemo(() => planShots(scene, cast, staging, s.first ? posterHold(staging) : 0),
    [scene, cast, staging, s.first]);
  const at = scene.twist ? scene.twist.atMs : Infinity;
  const hold = at + (9 * 1000) / fps; // everything stops once the stamp's shake is over
  const msA = Math.min(ms, hold);
  const frameA = frame - ((ms - msA) / 1000) * fps;
  const victim = victimOf(cast);
  const c: Ctx = {scene, cast, staging, mode: isLight(theme) ? "light" : "dark", ms, msA, frame, frameA, fps,
    index: s.index, shake: shockShake(scene, cast, msA, fps), victim, caller: callerOf(scene, cast), other: otherOf(scene, cast, victim), ad: adOf(scene, cast)};
  if (staging === "dochi_explains") return <DochiExplains c={c} body={body} />;
  const shot = shotAt(shots, msA);
  // the slow push-in of the shot times the keyword punch-in (1 -> 1.12 in 4 frames)
  const zoom = pushIn(c, shot.startMs, shot.endMs) * punchZoom(scene, msA, fps);
  const variant: HomeVariant = staging === "watch_ad" ? "sofa" : "living";
  let picture: React.ReactNode;
  if (shot.name === "twist" || staging === "twist_closeup") {
    picture = <TwistShot c={c} variant={variant} />;
  } else {
    switch (staging) {
      case "pip_call": picture = <PipCall c={c} shot={shot.name} zoom={zoom} />; break;
      case "split_call": picture = <SplitCall c={c} zoom={zoom} />; break;
      case "solo": picture = <Solo c={c} shot={shot.name} zoom={zoom} />; break;
      case "over_shoulder_chat": picture = <OverShoulder c={c} shot={shot.name} zoom={zoom} body={body} />; break;
      case "watch_ad": picture = <WatchAd c={c} shot={shot.name} zoom={zoom} />; break;
      default: picture = null;
    }
  }
  return <div style={{position: "absolute", inset: 0, overflow: "hidden", ...(s.first ? shell : {opacity: exit})}}>
    {picture}</div>;
};

