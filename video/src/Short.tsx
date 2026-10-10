import React from "react";
import {
  AbsoluteFill,
  Audio,
  Freeze,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {Bell} from "lucide-react";
import {FONT} from "./fonts";
import {CallScene, callAvatar} from "./CallScene";
import {BADGE, CardScene} from "./CardScene";
import {CastContext, useCast} from "./dialogue";
import {CastScene} from "./CastScene";
import {CastStyleContext} from "./Actor";
import {isDrama, SPEC, stagingOf} from "./rig";
import {Stamp} from "./Handwriting";
import {CHIP} from "./kit";
import {AnchorSpec, fadeOut, MORPH, RealFrameContext, SceneContext, spr, Transition, useScene} from "./motion";
import {Backdrop} from "./Backdrop";
import {BRAND, CATEGORIES, CategoryContext, categoryFor, isLight, NOTE, SeedContext, ThemeContext, themeFor,
  useCategory, useTheme} from "./themes";
import {seedOf} from "./hand";
import {Traveller} from "./Traveller";
import {MascotTrack, mascotOn} from "./Mascot";
import {Captions} from "./Captions";
import {AlertScene} from "./AlertScene";
import {ChatScene} from "./ChatScene";
import {ChecklistScene} from "./ChecklistScene";
import {ALERT_LAND, chatBeats, checklistTicks, compareBeats, dotBeats, flowBeats, smsBeats, STAT_COUNT, TOGGLE_CIRCLE,
  timelineBeats, toggleTaps} from "./schedule";
import {CompareScene} from "./CompareScene";
import {DotsScene} from "./DotsScene";
import {FlowScene} from "./FlowScene";
import {ToggleScene} from "./ToggleScene";
import {SmsScene} from "./SmsScene";
import {StatScene} from "./StatScene";
import {TimelineScene} from "./TimelineScene";
import {ACCENTS, SceneProps, ShortProps} from "./types";

const sceneFrames = (props: ShortProps, fps: number) => {
  let from = 0;
  return props.scenes.map((s) => {
    const frames = Math.max(1, Math.round((s.durationMs / 1000) * fps));
    const out = {from, frames};
    from += frames;
    return out;
  });
};

/** Series name in the episode chip ("생존노트 #3"). */
export const SERIES = "생존노트";

/**
 * Brand line (fixed position on every stage): the topic category tag, the series chip ("생존노트 #N", scheduled
 * episodes only), the channel name and the "AI 음성" badge. Only the colours follow the stage (light text on
 * dark-luminance stages, dark ink on light ones). It never depends on the frame (except the progress bar), so the
 * poster tail shows exactly the brand line of frame 0.
 */
const TopBar: React.FC<{channel: string; voiceLabel?: string; episodeNo?: number}> = ({channel, voiceLabel,
  episodeNo}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const t = useTheme();
  const cat = CATEGORIES[useCategory()];
  const paper = isLight(t);
  const ink = `${t.stageInk}${Math.round(BRAND.inkAlpha * 255).toString(16)}`;
  return (
    <>
      <div style={{position: "absolute", top: 0, left: 0, height: 12, width: `${(frame / durationInFrames) * 100}%`,
        background: paper ? t.progress : ACCENTS.yellow, boxShadow: paper ? "none" : `0 0 18px ${ACCENTS.yellow}`}} />
      <div style={{position: "absolute", top: 96, width: "100%", display: "flex", justifyContent: "center",
        alignItems: "center", fontSize: 36, fontWeight: 700, color: ink, letterSpacing: 1}}>
        <span style={{marginRight: 18, padding: "5px 16px", borderRadius: 999, fontSize: 26, fontWeight: 800,
          letterSpacing: 0, background: cat.tint, color: cat.ink}}>{cat.label}</span>
        {episodeNo ? (
          // the series chip: an outline beside the filled category tag, quieter than both tag and badge
          <span style={{marginLeft: -6, marginRight: 18, padding: "3px 13px", borderRadius: 999, fontSize: 25,
            fontWeight: 800, letterSpacing: 0, whiteSpace: "nowrap", border: `2px solid ${t.stageInk}59`}}>
            {SERIES} #{episodeNo}
          </span>
        ) : null}
        {channel}
        {voiceLabel ? (
          <span style={{marginLeft: 18, padding: "4px 14px", borderRadius: 10, fontSize: 28, fontWeight: 700,
            border: `2px solid ${t.stageInk}73`}}>
            {voiceLabel}
          </span>
        ) : null}
      </div>
    </>
  );
};
/** Frames the first scene's visuals are advanced by (see the poster start in Short). */
export const POSTER = 24;

const DisclaimerBadge: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame + POSTER, fps, config: {damping: 16}});
  return (
    <div style={{position: "absolute", top: 160, width: "100%", display: "flex", justifyContent: "center",
      opacity: s, transform: `translateY(${(1 - s) * -20}px)`}}>
      <div style={{padding: "12px 30px", borderRadius: 999, background: BRAND.disclaimerBg,
        border: `3px solid ${ACCENTS.red}`, color: BRAND.disclaimerText, fontSize: 34, fontWeight: 700}}>
        {text}
      </div>
    </div>
  );
};

/** Frames of the value CTA at the end of the closing scene (~1.2 s, <= 2 s). It ends with the scene, before the tail. */
export const CTA_FRAMES = 36;
const CTA_OUT = 8; // fades out over the closing scene's own exit, fully gone on its last frame

/**
 * Value CTA (visual only, no audio, no extra time): a small chip with a bell under the brand line (the opening
 * disclaimer's slot, free in the closing scene) for the last CTA_FRAMES of the closing scene. Mounted in a Sequence
 * that ends where the poster tail starts, so the loop/thumbnail frame never shows it.
 */
const ValueCta: React.FC<{text: string; frames: number}> = ({text, frames}) => {
  const frame = useCurrentFrame();
  const cat = CATEGORIES[useCategory()];
  const inP = spr(frame, 0, 10, 0);
  const out = Math.min(1, Math.max(0, (frames - 1 - frame) / CTA_OUT));
  const op = Math.min(1, inP) * out;
  // one small ring of the bell once the chip has landed (damped, two swings)
  const r = Math.max(0, frame - 8);
  const swing = frame >= 8 ? 16 * Math.exp(-r / 6) * Math.sin(r * 0.9) : 0;
  if (op <= 0) return null;
  return (
    <div style={{position: "absolute", top: 162, width: "100%", display: "flex", justifyContent: "center",
      opacity: op, transform: `translateY(${(1 - inP) * -12}px)`}}>
      <div style={{display: "flex", alignItems: "center", gap: 12, padding: "9px 26px 9px 18px", borderRadius: 999,
        background: NOTE.paper, color: NOTE.ink, fontSize: 32, fontWeight: 800, whiteSpace: "nowrap",
        boxShadow: "0 8px 20px rgba(10,14,25,0.22)"}}>
        <span style={{display: "flex", transform: `rotate(${swing}deg)`, transformOrigin: "50% 8%"}}>
          <Bell size={32} color={cat.ink} strokeWidth={2.4} />
        </span>
        {text}
      </div>
    </div>
  );
};

const Sfx: React.FC<{name: string; at: number; volume: number; until?: number}> = ({name, at, volume, until}) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={until ? Math.max(1, Math.round(until - at)) : undefined}
    layout="none">
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);

/** Where the twist stamp lands: over the middle of the mockup / card, well above the speaker chip and captions. */
const STAMP_Y = 640;

/**
 * A scene's visuals. A twist scene freezes at the reveal (Remotion's Freeze from twist.atMs on, slightly
 * desaturated, a 6-frame shake as the stamp hits; the stamp itself is TwistStamp, a layer above the travellers); the
 * exit fade and the shared-element hand-off keep running on the real frame (RealFrameContext), and 도치
 * (MascotTrack) stays alive and reacts.
 */
const SceneVisual: React.FC<{scene: SceneProps; shift: number}> = ({scene, shift}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cast = useCast();
  // a drama staging plays its own reveal (close-up, flash, freeze), so it is never frozen from outside
  if (!scene.twist || isDrama(stagingOf(scene, cast))) return <SceneBody scene={scene} />;
  const at = Math.round((scene.twist.atMs / 1000) * fps) + shift;
  const frozen = frame >= at;
  const k = frozen ? Math.min(1, (frame - at + 1) / 3) : 0;
  const hit = frame - at;
  const shake = frozen && hit < 6 ? Math.sin(hit * 2.9) * 9 * (1 - hit / 6) : 0;
  return (
    <RealFrameContext.Provider value={frame}>
      <div style={{position: "absolute", inset: 0, filter: k ? `grayscale(${0.65 * k}) brightness(${1 - 0.12 * k})` : undefined,
        transform: shake ? `translate(${shake}px, ${shake * 0.4}px)` : undefined}}>
        <Freeze frame={at} active={frozen}>
          <SceneBody scene={scene} />
        </Freeze>
      </div>
    </RealFrameContext.Provider>
  );
};

/**
 * The twist stamp, drawn above the scene and the shared-element traveller (so the caller's avatar flies out from
 * under it into the next scene). Scene-local frames on the audio clock; it fades with the scene's exit.
 */
const TwistStamp: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = useScene();
  const cast = useCast();
  if (!scene.twist) return null;
  // drama: on the victim's chest in the shocked close-up, under the chin (never over the eyes or the mouth)
  const drama = isDrama(stagingOf(scene, cast));
  const spot = drama ? SPEC.twist_closeup.stamp : {x: s.mascot ? 589 : 540, y: STAMP_Y};
  const at = Math.round((scene.twist.atMs / 1000) * fps);
  const exit = s.mode === "continuity" && !s.last ? fadeOut(frame, s.frames)
    : interpolate(frame, [s.frames - 7, s.frames], [1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  return (
    <div style={{position: "absolute", inset: 0, opacity: exit}}>
      <Stamp text={scene.twist.text} at={at} x={spot.x} y={spot.y} />
    </div>
  );
};

/**
 * A scene's picture: a dialogue scene with rigged characters is staged (CastScene: its layout's own picture is reused
 * where it carries information, the thread in the hand or the explainer beside the family); else the layout.
 */
const SceneBody: React.FC<{scene: SceneProps}> = ({scene}) => {
  const cast = useCast();
  const staging = stagingOf(scene, cast);
  if (!staging) return <LayoutBody scene={scene} />;
  const body = staging === "over_shoulder_chat" ? <LayoutBody scene={scene} bare />
    : staging === "dochi_explains" ? <LayoutBody scene={scene} /> : null;
  return <CastScene scene={scene} staging={staging} body={body} />;
};

const LayoutBody: React.FC<{scene: SceneProps; bare?: boolean}> = ({scene, bare}) => {
  switch (scene.layout) {
    case "call": return <CallScene scene={scene} />;
    case "chat": return <ChatScene scene={scene} bare={bare} />;
    case "sms": return <SmsScene scene={scene} bare={bare} />;
    case "alert": return <AlertScene scene={scene} />;
    case "stat": return <StatScene scene={scene} />;
    case "timeline": return <TimelineScene scene={scene} />;
    case "checklist": return <ChecklistScene scene={scene} />;
    case "compare": return <CompareScene scene={scene} />;
    case "toggle": return <ToggleScene scene={scene} />;
    case "flow": return <FlowScene scene={scene} />;
    case "dots": return <DotsScene scene={scene} />;
    default: return <CardScene scene={scene} />;
  }
};

type SfxProps = {scene: SceneProps; first: boolean; last: boolean; lead: number; words: number; fps: number};

/** Synthesized SFX, timed from the same schedules the scene components animate with; plus the twist stamp. */
const SceneSfx: React.FC<SfxProps> = (props) => {
  const {scene, fps} = props;
  // the reveal: a stamp thud with a pop as the stamp lands on the frozen frame
  const at = scene.twist ? Math.round((scene.twist.atMs / 1000) * fps) : 0;
  return (
    <>
      <LayoutSfx {...props} />
      {scene.twist ? <Sfx name="stamp" at={at} volume={0.7} /> : null}
      {scene.twist ? <Sfx name="pop" at={at + 1} volume={0.32} /> : null}
    </>
  );
};

const LayoutSfx: React.FC<SfxProps> = ({scene, first, last, lead, words, fps}) => {
  const whoosh = first ? null : <Sfx name="whoosh" at={0} volume={0.35} />;
  const pops = (frames: number[], volume = 0.28) => frames.map((f, k) => (
    <Sfx key={k} name={last && k === frames.length - 1 ? "ding" : "pop"} at={f} volume={volume} />
  ));
  switch (scene.layout) {
    case "call":
      // a dialogue call rings only through its lead-in (none in the opening scene: the voice starts at once)
      if (scene.lines?.length) {
        return lead >= 15 ? <Sfx name="ring" at={0} volume={0.5} until={lead - 2} /> : null;
      }
      return (
        <>
          <Sfx name="ring" at={0} volume={0.55} until={lead + 6} />
          <Sfx name="vibrate" at={0} volume={0.5} until={lead + 4} />
        </>
      );
    case "chat":
      return <>{whoosh}{pops(chatBeats(scene, fps).map((b) => b.showAt).filter((f) => f >= 0), 0.26)}</>;
    case "sms": {
      const b = smsBeats(scene, fps);
      return (
        <>
          {whoosh}
          <Sfx name="vibrate" at={b.arrive - 2} volume={0.4} until={b.arrive + 14} />
          <Sfx name="pop" at={b.arrive} volume={0.3} />
          {b.replies.map((r, k) => <Sfx key={k} name="pop" at={r.at} volume={0.24} />)}
        </>
      );
    }
    case "alert":
      return (
        <>
          {whoosh}
          <Sfx name="vibrate" at={ALERT_LAND - 2} volume={0.4} until={ALERT_LAND + 12} />
          <Sfx name="ding" at={ALERT_LAND - 2} volume={0.32} />
        </>
      );
    case "stat":
      return <>{whoosh}<Sfx name={last ? "ding" : "pop"} at={STAT_COUNT[1]} volume={0.3} /></>;
    case "timeline":
      return <>{whoosh}{pops(timelineBeats(scene, fps))}</>;
    case "checklist":
      return <>{whoosh}{pops(checklistTicks(scene, fps))}</>;
    case "compare":
      return <>{whoosh}{pops(compareBeats(scene, fps))}</>;
    case "toggle": {
      const taps = toggleTaps(scene, fps);
      return <>{whoosh}{pops([...taps, taps[taps.length - 1] + TOGGLE_CIRCLE])}</>;
    }
    case "flow":
      return <>{whoosh}{pops(flowBeats(scene, fps))}</>;
    case "dots":
      return <>{whoosh}{pops(dotBeats(scene, fps), 0.24)}</>;
    default:
      return <>{whoosh}<Sfx name={last ? "ding" : "pop"} at={6 + words * 3} volume={0.3} /></>;
  }
};

/** Background music: fades in/out, ducks under narration with short ramps so lines stay clear. */
const MusicBed: React.FC<{props: ShortProps}> = ({props}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const music = props.music;
  if (!music) return null;
  const spans = sceneFrames(props, fps);
  const windows = props.scenes.map((s, i) => {
    const a = spans[i].from + Math.round((s.leadInMs / 1000) * fps);
    return [a, a + Math.round((s.speechMs / 1000) * fps)] as const;
  });
  const RAMP = 6;
  const volume = (f: number) => {
    let duck = 0;
    for (const [a, b] of windows) {
      if (f >= a - RAMP && f <= b + RAMP) {
        const d = f < a ? (a - f) / RAMP : f > b ? (f - b) / RAMP : 0;
        duck = Math.max(duck, 1 - d);
      }
    }
    const fadeIn = Math.min(1, f / 12);
    const fadeOut = Math.min(1, Math.max(0, (durationInFrames - f) / 30));
    return (music.volume + (music.duckVolume - music.volume) * duck) * fadeIn * fadeOut;
  };
  return <Audio src={staticFile(music.src)} volume={volume} />;
};

/** The element a scene hands over at a continuity transition (see Traveller.tsx). */
const anchorSpec = (scene: SceneProps): AnchorSpec => {
  if (scene.layout === "call") {
    return {look: {kind: "avatar", letter: (scene.caller ?? "알 수 없음").slice(0, 1)}, size: callAvatar(scene)};
  }
  const look = {kind: "chip", icon: scene.icon, accent: scene.accent} as const;
  return scene.layout === "card" ? {look, size: BADGE, glow: 60} : {look, size: CHIP};
};

export const Short: React.FC<ShortProps> = (props) => {
  const {fps, durationInFrames} = useVideoConfig();
  const spans = sceneFrames(props, fps);
  const mode: Transition = props.transition === "classic" ? "classic" : "continuity";
  const cont = mode === "continuity";
  const n = props.scenes.length;
  const end = n ? spans[n - 1].from + spans[n - 1].frames : 0;
  const tail = Math.round(((props.posterTailMs ?? 0) / 1000) * fps);
  const theme = themeFor(props.theme);
  const castMap = props.cast ?? {};
  const on = props.scenes.map((s) => mascotOn(s, theme, castMap));
  // drama stagings have no shared element: the boundaries next to one crossfade without the traveller
  const drama = props.scenes.map((s) => isDrama(stagingOf(s, castMap)));
  const noMorph = (i: number) => ({noMorphIn: i > 0 && (drama[i] || drama[i - 1]),
    noMorphOut: i < n - 1 && (drama[i] || drama[i + 1])});
  // per-episode variants of the stage come from Python's seed (CRC32 of the script id), never from randomness
  const seed = typeof props.seed === "number" ? props.seed >>> 0 : seedOf(props.episode ?? "");
  return (
    <ThemeContext.Provider value={theme}>
    <SeedContext.Provider value={seed}>
    <CastContext.Provider value={props.cast ?? {}}>
    <CastStyleContext.Provider value={props.castStyle === "animal" ? "animal" : "human"}>
    <CategoryContext.Provider value={categoryFor(props.category)}>
    <AbsoluteFill style={{fontFamily: FONT, color: "#fff", wordBreak: "keep-all"}}>
      <Backdrop props={props} />
      <MusicBed props={props} />
      {/* scene visuals; in continuity mode each one stays mounted a little past its end (fading out)
          so the traveller can measure its anchor and the two scenes can crossfade */}
      <div data-scenes="" style={{position: "absolute", inset: 0}}>
        {props.scenes.map((scene, i) => {
          const {from, frames} = spans[i];
          const last = i === n - 1;
          return (
            <Sequence key={i} from={from} durationInFrames={frames + (cont && !last ? MORPH : 0)}>
              {i === 0 ? (
                // Poster start: the first scene's visuals run POSTER frames ahead, so frame 0 (the feed preview,
                // and the moment viewers decide to swipe) already shows the finished hook, not an empty screen.
                <Sequence from={-POSTER} layout="none">
                  <SceneContext.Provider value={{mode, index: i, frames: frames + POSTER, first: true, last, mascot: on[i],
                    share: last ? props.shareLine : undefined, shift: POSTER, ...noMorph(i)}}>
                    <SceneVisual scene={scene} shift={POSTER} />
                  </SceneContext.Provider>
                </Sequence>
              ) : (
                <SceneContext.Provider value={{mode, index: i, frames, first: false, last, mascot: on[i],
                  share: last ? props.shareLine : undefined, ...noMorph(i)}}>
                  <SceneVisual scene={scene} shift={0} />
                </SceneContext.Provider>
              )}
            </Sequence>
          );
        })}
        {cont ? props.scenes.slice(1).map((scene, j) => drama[j] || drama[j + 1] ? null : (
          <Sequence key={`t${j}`} from={spans[j + 1].from} durationInFrames={MORPH}>
            <Traveller index={j} from={anchorSpec(props.scenes[j])} to={anchorSpec(scene)}
              hideFrom={Boolean(props.scenes[j].twist)} />
          </Sequence>
        )) : null}
        {props.scenes.map((scene, i) => scene.twist ? (
          <Sequence key={`tw${i}`} from={spans[i].from} durationInFrames={spans[i].frames + (cont && i < n - 1 ? MORPH : 0)}>
            <SceneContext.Provider value={{mode, index: i, frames: spans[i].frames, first: i === 0, last: i === n - 1,
              mascot: on[i], ...noMorph(i)}}>
              <TwistStamp scene={scene} />
            </SceneContext.Provider>
          </Sequence>
        ) : null)}
      </div>
      {/* 도치 the mascot: one continuous track over the whole video (in the margin, never on text or captions) */}
      <MascotTrack props={props} spans={spans} poster={POSTER} />
      {/* narration, captions and SFX keep the exact scene spans in both modes */}
      {props.scenes.map((scene, i) => {
        const {from, frames} = spans[i];
        const lead = Math.round((scene.leadInMs / 1000) * fps);
        const words = scene.headline.split(" ").length;
        return (
          <Sequence key={i} from={from} durationInFrames={frames}>
            <Captions pages={scene.pages} instantFirst={i === 0} />
            {scene.audio ? (
              <Sequence from={lead} layout="none">
                <Audio src={staticFile(scene.audio)} />
              </Sequence>
            ) : null}
            {props.sfx ? <SceneSfx scene={scene} first={i === 0} last={i === props.scenes.length - 1}
              lead={lead} words={words} fps={fps} /> : null}
          </Sequence>
        );
      })}
      {tail > 0 && n ? (
        // Poster tail: the opening frame again (first scene settled, first caption page, disclaimer badge), so the
        // loop back to frame 0 is seamless and this frame can be picked as the Shorts thumbnail in the app.
        // (to the composition's last frame: its length rounds the total, the scenes round one by one)
        <Sequence from={end} durationInFrames={Math.max(tail, durationInFrames - end)}>
          {/* the frozen frame must stay inside the sequence's own length (Remotion clamps it to the 15-frame tail),
              so the scene is shifted by POSTER and frozen at its local frame 0 = the opening frame's POSTER */}
          <Sequence from={-POSTER} layout="none">
            <Freeze frame={0}>
              <SceneContext.Provider value={{mode, index: 0, frames: spans[0].frames + POSTER, first: true, last: false, mascot: on[0],
                shift: POSTER, ...noMorph(0)}}>
                <SceneBody scene={props.scenes[0]} />
              </SceneContext.Provider>
            </Freeze>
          </Sequence>
          <Freeze frame={0}>
            <Captions pages={props.scenes[0].pages} instantFirst />
            <DisclaimerBadge text={props.disclaimer} />
          </Freeze>
        </Sequence>
      ) : null}
      {props.cta && n ? (() => {
        // the closing scene's last CTA_FRAMES (shorter if the scene is): ends exactly where the poster tail begins
        const from = Math.max(spans[n - 1].from, end - CTA_FRAMES);
        return (
          <Sequence from={from} durationInFrames={Math.max(1, end - from)}>
            <ValueCta text={props.cta} frames={end - from} />
          </Sequence>
        );
      })() : null}
      <TopBar channel={props.channel} voiceLabel={props.voiceLabel} episodeNo={props.episodeNo} />
      {/* the 재연 badge stays up through the last dramatized scene (dialogue lines or the twist stamp), so no
          re-enacted moment is ever shown without it; explainers keep it on the first scene only */}
      <Sequence durationInFrames={(() => {
        const k = props.scenes.reduce((last, s, i) => (s.lines?.length || s.twist ? i : last), 0);
        return spans[k] ? spans[k].from + spans[k].frames : fps * 3;
      })()}>
        <DisclaimerBadge text={props.disclaimer} />
      </Sequence>
    </AbsoluteFill>
    </CategoryContext.Provider>
    </CastStyleContext.Provider>
    </CastContext.Provider>
    </SeedContext.Provider>
    </ThemeContext.Provider>
  );
};

