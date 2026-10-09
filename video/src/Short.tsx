import React from "react";
import {
  AbsoluteFill,
  Audio,
  Freeze,
  interpolateColors,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {FONT} from "./fonts";
import {CALL_AVATAR, CallScene} from "./CallScene";
import {BADGE, CardScene} from "./CardScene";
import {CHIP} from "./kit";
import {AnchorSpec, fade, MORPH, SceneContext, Transition} from "./motion";
import {Traveller} from "./Traveller";
import {Captions} from "./Captions";
import {AlertScene} from "./AlertScene";
import {ChatScene} from "./ChatScene";
import {ChecklistScene} from "./ChecklistScene";
import {ALERT_LAND, chatBeats, checklistTicks, SMS_ARRIVE, STAT_COUNT, timelineBeats} from "./schedule";
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

/** Slowly drifting grid + two soft glows whose color follows the current scene's accent. */
const Background: React.FC<{props: ShortProps}> = ({props}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const spans = sceneFrames(props, fps);
  let idx = spans.findIndex((s) => frame < s.from + s.frames);
  if (idx < 0) idx = spans.length - 1;
  const prev = props.scenes[Math.max(0, idx - 1)].accent;
  const cur = props.scenes[idx].accent;
  const color = interpolateColors(fade(frame, spans[idx].from, 16), [0, 1], [ACCENTS[prev], ACCENTS[cur]]);
  const drift = (frame * 0.7) % 90;
  const gx = Math.sin(frame / 55) * 80;
  const gy = Math.cos(frame / 70) * 60;
  return (
    <AbsoluteFill style={{background: "linear-gradient(180deg, #060b16 0%, #0b1730 55%, #0e1d3a 100%)"}}>
      <AbsoluteFill
        style={{
          opacity: 0.08,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.9) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.9) 2px, transparent 2px)",
          backgroundSize: "90px 90px",
          backgroundPosition: `0px ${drift}px`,
        }}
      />
      <div style={{position: "absolute", width: 900, height: 900, left: -250 + gx, top: 120 + gy, borderRadius: "50%",
        background: color, opacity: 0.22, filter: "blur(160px)"}} />
      <div style={{position: "absolute", width: 800, height: 800, right: -300 - gx, bottom: 80 - gy, borderRadius: "50%",
        background: color, opacity: 0.14, filter: "blur(170px)"}} />
      <AbsoluteFill style={{background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)"}} />
    </AbsoluteFill>
  );
};

const TopBar: React.FC<{channel: string; voiceLabel?: string}> = ({channel, voiceLabel}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return (
    <>
      <div style={{position: "absolute", top: 0, left: 0, height: 12, width: `${(frame / durationInFrames) * 100}%`,
        background: ACCENTS.yellow, boxShadow: `0 0 18px ${ACCENTS.yellow}`}} />
      <div style={{position: "absolute", top: 96, width: "100%", textAlign: "center", fontSize: 36, fontWeight: 700,
        color: "rgba(214,224,240,0.75)", letterSpacing: 1}}>
        {channel}
        {voiceLabel ? (
          <span style={{marginLeft: 18, padding: "4px 14px", borderRadius: 10, fontSize: 28, fontWeight: 700,
            border: "2px solid rgba(214,224,240,0.45)", verticalAlign: "middle"}}>
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
      <div style={{padding: "12px 30px", borderRadius: 999, background: "rgba(0,0,0,0.6)",
        border: `3px solid ${ACCENTS.red}`, color: "#fff", fontSize: 34, fontWeight: 700}}>
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
  return scene.layout === "card" ? {look, size: BADGE, glow: 60} : {look, size: CHIP, glow: 36};
};

export const Short: React.FC<ShortProps> = (props) => {
  const {fps} = useVideoConfig();
  const spans = sceneFrames(props, fps);
  const mode: Transition = props.transition === "classic" ? "classic" : "continuity";
  const cont = mode === "continuity";
  const n = props.scenes.length;
  const end = n ? spans[n - 1].from + spans[n - 1].frames : 0;
  const tail = Math.round(((props.posterTailMs ?? 0) / 1000) * fps);
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: "#fff", wordBreak: "keep-all"}}>
      <Background props={props} />
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
                  <SceneContext.Provider value={{mode, index: i, frames: frames + POSTER, first: true, last}}>
                    <SceneBody scene={scene} />
                  </SceneContext.Provider>
                </Sequence>
              ) : (
                <SceneContext.Provider value={{mode, index: i, frames, first: false, last}}>
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
          <Freeze frame={POSTER}>
            <SceneContext.Provider value={{mode, index: 0, frames: spans[0].frames + POSTER, first: true, last: false}}>
              <SceneBody scene={props.scenes[0]} />
            </SceneContext.Provider>
          </Freeze>
          <Freeze frame={0}>
            <Captions pages={props.scenes[0].pages} instantFirst />
            <DisclaimerBadge text={props.disclaimer} />
          </Freeze>
        </Sequence>
      ) : null}
      <TopBar channel={props.channel} voiceLabel={props.voiceLabel} />
      <Sequence durationInFrames={spans[0]?.frames ?? fps * 3}>
        <DisclaimerBadge text={props.disclaimer} />
      </Sequence>
    </AbsoluteFill>
  );
};

