import React from "react";
import {
  AbsoluteFill,
  Audio,
  Freeze,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {Bell} from "lucide-react";
import {FONT} from "./fonts";
import {CALL_AVATAR, CallScene} from "./CallScene";
import {BADGE, CardScene} from "./CardScene";
import {CHIP} from "./kit";
import {AnchorSpec, MORPH, SceneContext, spr, Transition} from "./motion";
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
import {ALERT_LAND, chatBeats, checklistTicks, compareBeats, dotBeats, flowBeats, SMS_ARRIVE, STAT_COUNT, TOGGLE_CIRCLE,
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

const SceneBody: React.FC<{scene: SceneProps}> = ({scene}) => {
  switch (scene.layout) {
    case "call": return <CallScene scene={scene} />;
    case "chat": return <ChatScene scene={scene} />;
    case "sms": return <SmsScene scene={scene} />;
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

/** Synthesized SFX, timed from the same schedules the scene components animate with. */
const SceneSfx: React.FC<{scene: SceneProps; first: boolean; last: boolean; lead: number; words: number;
  fps: number}> = ({scene, first, last, lead, words, fps}) => {
  const whoosh = first ? null : <Sfx name="whoosh" at={0} volume={0.35} />;
  const pops = (frames: number[], volume = 0.28) => frames.map((f, k) => (
    <Sfx key={k} name={last && k === frames.length - 1 ? "ding" : "pop"} at={f} volume={volume} />
  ));
  switch (scene.layout) {
    case "call":
      return (
        <>
          <Sfx name="ring" at={0} volume={0.55} until={lead + 6} />
          <Sfx name="vibrate" at={0} volume={0.5} until={lead + 4} />
        </>
      );
    case "chat":
      return <>{whoosh}{pops(chatBeats(scene, fps).map((b) => b.showAt), 0.26)}</>;
    case "sms":
      return (
        <>
          {whoosh}
          <Sfx name="vibrate" at={SMS_ARRIVE - 2} volume={0.4} until={SMS_ARRIVE + 14} />
          <Sfx name="pop" at={SMS_ARRIVE} volume={0.3} />
        </>
      );
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
    return {look: {kind: "avatar", letter: (scene.caller ?? "알 수 없음").slice(0, 1)}, size: CALL_AVATAR};
  }
  const look = {kind: "chip", icon: scene.icon, accent: scene.accent} as const;
  return scene.layout === "card" ? {look, size: BADGE, glow: 60} : {look, size: CHIP};
};

export const Short: React.FC<ShortProps> = (props) => {
  const {fps} = useVideoConfig();
  const spans = sceneFrames(props, fps);
  const mode: Transition = props.transition === "classic" ? "classic" : "continuity";
  const cont = mode === "continuity";
  const n = props.scenes.length;
  const end = n ? spans[n - 1].from + spans[n - 1].frames : 0;
  const tail = Math.round(((props.posterTailMs ?? 0) / 1000) * fps);
  const theme = themeFor(props.theme);
  const on = props.scenes.map((s) => mascotOn(s, theme));
  // per-episode variants of the stage come from Python's seed (CRC32 of the script id), never from randomness
  const seed = typeof props.seed === "number" ? props.seed >>> 0 : seedOf(props.episode ?? "");
  return (
    <ThemeContext.Provider value={theme}>
    <SeedContext.Provider value={seed}>
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
                    share: last ? props.shareLine : undefined}}>
                    <SceneBody scene={scene} />
                  </SceneContext.Provider>
                </Sequence>
              ) : (
                <SceneContext.Provider value={{mode, index: i, frames, first: false, last, mascot: on[i],
                  share: last ? props.shareLine : undefined}}>
                  <SceneBody scene={scene} />
                </SceneContext.Provider>
              )}
            </Sequence>
          );
        })}
        {cont ? props.scenes.slice(1).map((scene, j) => (
          <Sequence key={`t${j}`} from={spans[j + 1].from} durationInFrames={MORPH}>
            <Traveller index={j} from={anchorSpec(props.scenes[j])} to={anchorSpec(scene)} />
          </Sequence>
        )) : null}
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
        <Sequence from={end} durationInFrames={tail}>
          {/* the frozen frame must stay inside the sequence's own length (Remotion clamps it to the 15-frame tail),
              so the scene is shifted by POSTER and frozen at its local frame 0 = the opening frame's POSTER */}
          <Sequence from={-POSTER} layout="none">
            <Freeze frame={0}>
              <SceneContext.Provider value={{mode, index: 0, frames: spans[0].frames + POSTER, first: true, last: false, mascot: on[0]}}>
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
      <Sequence durationInFrames={spans[0]?.frames ?? fps * 3}>
        <DisclaimerBadge text={props.disclaimer} />
      </Sequence>
    </AbsoluteFill>
    </CategoryContext.Provider>
    </SeedContext.Provider>
    </ThemeContext.Provider>
  );
};

