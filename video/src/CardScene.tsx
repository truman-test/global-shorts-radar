import React from "react";
import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {Icon} from "./icons";
import {ACCENTS, SceneProps} from "./types";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;

/** Explainer card: icon badge springs in and floats, headline words pop in one by one, accent rule grows. */
export const CardScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const accent = ACCENTS[scene.accent];
  const enter = spring({frame, fps, config: {damping: 15, mass: 0.7}});
  const exit = interpolate(frame, [durationInFrames - 7, durationInFrames], [1, 0], clamp);
  const iconIn = spring({frame: frame - 2, fps, config: {damping: 11, mass: 0.6}});
  const float = Math.sin(frame / 13) * 8;
  const pulse = (frame % 45) / 45;
  const words = scene.headline.split(" ");
  const ruleIn = spring({frame: frame - (6 + words.length * 3), fps, config: {damping: 18}});
  const subIn = interpolate(frame, [10 + words.length * 3, 22 + words.length * 3], [0, 1], clamp);

  return (
    <div style={{position: "absolute", inset: 0, opacity: exit,
      transform: `translateX(${(1 - enter) * 120}px) scale(${0.97 + 0.03 * enter})`}}>
      {/* icon badge */}
      <div style={{position: "absolute", left: 540 - 135, top: 400, width: 270, height: 270,
        transform: `translateY(${float}px) scale(${0.3 + 0.7 * iconIn})`, opacity: iconIn}}>
        <div style={{position: "absolute", inset: 0, borderRadius: "50%", border: `4px solid ${accent}`,
          opacity: 0.6 * (1 - pulse), transform: `scale(${1 + pulse * 0.45})`}} />
        <div style={{position: "absolute", inset: 0, borderRadius: "50%", background: `${accent}22`,
          border: `3px solid ${accent}88`, boxShadow: `0 0 60px ${accent}55`, display: "flex",
          alignItems: "center", justifyContent: "center"}}>
          <Icon name={scene.icon} size={140} color={accent} />
        </div>
      </div>
      {/* headline */}
      <div style={{position: "absolute", top: 760, left: 90, right: 90, textAlign: "center", fontSize: 104,
        fontWeight: 900, lineHeight: 1.2, letterSpacing: -2, textWrap: "balance" as React.CSSProperties["textWrap"]}}>
        {words.map((w, i) => {
          const s = spring({frame: frame - (4 + i * 3), fps, config: {damping: 12, mass: 0.6}});
          return (
            <span key={i} style={{display: "inline-block", marginRight: 26, opacity: s,
              transform: `translateY(${(1 - s) * 40}px) scale(${0.85 + 0.15 * s})`,
              textShadow: "0 8px 30px rgba(0,0,0,0.6)"}}>
              {w}
            </span>
          );
        })}
      </div>
      {/* accent rule + sub */}
      <div style={{position: "absolute", top: 1035, width: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 26}}>
        <div style={{width: 200 * ruleIn, height: 12, borderRadius: 6, background: accent,
          boxShadow: `0 0 24px ${accent}`}} />
        {scene.sub ? (
          <div style={{fontSize: 46, fontWeight: 700, color: "rgba(214,224,240,0.9)", opacity: subIn,
            transform: `translateY(${(1 - subIn) * 14}px)`, padding: "0 110px", textAlign: "center"}}>
            {scene.sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};
