import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolateColors,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {FONT} from "./fonts";
import {CallScene} from "./CallScene";
import {CardScene} from "./CardScene";
import {Captions} from "./Captions";
import {ACCENTS, ShortProps} from "./types";

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
  const color = interpolateColors(frame - spans[idx].from, [0, 12], [ACCENTS[prev], ACCENTS[cur]]);
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

const TopBar: React.FC<{channel: string}> = ({channel}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return (
    <>
      <div style={{position: "absolute", top: 0, left: 0, height: 12, width: `${(frame / durationInFrames) * 100}%`,
        background: ACCENTS.yellow, boxShadow: `0 0 18px ${ACCENTS.yellow}`}} />
      <div style={{position: "absolute", top: 96, width: "100%", textAlign: "center", fontSize: 36, fontWeight: 700,
        color: "rgba(214,224,240,0.75)", letterSpacing: 1}}>
        {channel}
      </div>
    </>
  );
};

const DisclaimerBadge: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 16}});
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

export const Short: React.FC<ShortProps> = (props) => {
  const {fps} = useVideoConfig();
  const spans = sceneFrames(props, fps);
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: "#fff", wordBreak: "keep-all"}}>
      <Background props={props} />
      <MusicBed props={props} />
      {props.scenes.map((scene, i) => {
        const {from, frames} = spans[i];
        const lead = Math.round((scene.leadInMs / 1000) * fps);
        const words = scene.headline.split(" ").length;
        return (
          <Sequence key={i} from={from} durationInFrames={frames}>
            {scene.layout === "call" ? <CallScene scene={scene} /> : <CardScene scene={scene} />}
            <Captions pages={scene.pages} />
            {scene.audio ? (
              <Sequence from={lead} layout="none">
                <Audio src={staticFile(scene.audio)} />
              </Sequence>
            ) : null}
            {props.sfx ? (
              scene.layout === "call" ? (
                <>
                  <Sfx name="ring" at={0} volume={0.55} until={lead + 6} />
                  <Sfx name="vibrate" at={0} volume={0.5} until={lead + 4} />
                </>
              ) : (
                <>
                  {i > 0 ? <Sfx name="whoosh" at={0} volume={0.35} /> : null}
                  <Sfx name={i === props.scenes.length - 1 ? "ding" : "pop"} at={6 + words * 3} volume={0.3} />
                </>
              )
            ) : null}
          </Sequence>
        );
      })}
      <TopBar channel={props.channel} />
      <Sequence durationInFrames={spans[0]?.frames ?? fps * 3}>
        <DisclaimerBadge text={props.disclaimer} />
      </Sequence>
    </AbsoluteFill>
  );
};

