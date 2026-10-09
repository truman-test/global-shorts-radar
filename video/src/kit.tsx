import React from "react";
import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {Icon} from "./icons";
import {ACCENTS, SceneProps} from "./types";

export const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;

// Vertical zones (px) shared by the mockup layouts. The top bar/disclaimer sit above HEADER_TOP,
// captions start at 1255, and the bottom 20% + right rail belong to YouTube's own buttons.
export const HEADER_TOP = 248;
export const HEADER_H = 262;
export const BODY_TOP = 530;
export const BODY_BOTTOM = 1200;

export const TEXT = "#F3F6FB";
export const MUTED = "rgba(214,224,240,0.72)";
export const PANEL = "rgba(14,21,38,0.94)";
export const BUBBLE_THEM = "#26324D";
export const BUBBLE_ME = "#5B63F0"; // neutral indigo: deliberately not any real messenger's colour

/** Enter (slide up + fade) and exit (fade) shared by every mockup layout. */
export const SceneShell: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 18, mass: 0.7}});
  const exit = interpolate(frame, [durationInFrames - 7, durationInFrames], [1, 0], clamp);
  return (
    <div style={{position: "absolute", inset: 0, opacity: exit * Math.min(1, enter * 1.4),
      transform: `translateY(${(1 - enter) * 60}px)`}}>
      {children}
    </div>
  );
};

/** Headline with an icon chip, words popping in one by one, and the sub-line under it. */
export const SceneHeader: React.FC<{scene: SceneProps; top?: number; height?: number}> = ({
  scene, top = HEADER_TOP, height = HEADER_H,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = ACCENTS[scene.accent];
  const words = scene.headline.split(" ");
  // keep long headlines to two lines so they never reach the disclaimer badge or the mockup
  const n = scene.headline.replace(/\s/g, "").length;
  const size = n <= 13 ? 70 : n <= 18 ? 64 : n <= 24 ? 58 : 50;
  const iconIn = spring({frame: frame - 1, fps, config: {damping: 12, mass: 0.6}});
  const subIn = interpolate(frame, [8 + words.length * 2, 18 + words.length * 2], [0, 1], clamp);
  return (
    <div style={{position: "absolute", top, height, left: 70, right: 70, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 18}}>
      <div style={{display: "flex", alignItems: "center", gap: 26, maxWidth: 940}}>
        <div style={{flex: "0 0 auto", width: 92, height: 92, borderRadius: "50%", background: `${accent}22`,
          border: `3px solid ${accent}99`, boxShadow: `0 0 36px ${accent}55`, display: "flex", alignItems: "center",
          justifyContent: "center", opacity: iconIn, transform: `scale(${0.4 + 0.6 * iconIn})`}}>
          <Icon name={scene.icon} size={52} color={accent} />
        </div>
        <div style={{fontSize: size, fontWeight: 900, lineHeight: 1.16, letterSpacing: -1.5,
          textWrap: "balance" as React.CSSProperties["textWrap"]}}>
          {words.map((w, i) => {
            const s = spring({frame: frame - (3 + i * 2), fps, config: {damping: 13, mass: 0.6}});
            return (
              <span key={i} style={{display: "inline-block", marginRight: size * 0.24, opacity: s,
                transform: `translateY(${(1 - s) * 28}px)`, textShadow: "0 6px 26px rgba(0,0,0,0.6)"}}>
                {w}
              </span>
            );
          })}
        </div>
      </div>
      {scene.sub ? (
        <div style={{fontSize: 38, fontWeight: 700, color: MUTED, textAlign: "center", opacity: subIn,
          transform: `translateY(${(1 - subIn) * 10}px)`, maxWidth: 880}}>
          {scene.sub}
        </div>
      ) : null}
    </div>
  );
};

/** Rounded "screen" panel used by the chat and SMS mockups: invented header, no real app's look. */
export const PhonePanel: React.FC<{header: React.ReactNode; children: React.ReactNode; top?: number;
  bottom?: number}> = ({header, children, top = BODY_TOP, bottom = BODY_BOTTOM}) => (
  <div style={{position: "absolute", top, left: 110, width: 860, height: bottom - top, borderRadius: 48,
    background: PANEL, border: "2px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
    overflow: "hidden", display: "flex", flexDirection: "column"}}>
    <div style={{flex: "0 0 auto", height: 112, display: "flex", alignItems: "center", gap: 22, padding: "0 30px",
      borderBottom: "2px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)"}}>
      <div style={{fontSize: 56, fontWeight: 700, color: MUTED, marginTop: -8}}>‹</div>
      {header}
    </div>
    {children}
  </div>
);

export const Avatar: React.FC<{label: string; size?: number; color?: string; children?: React.ReactNode}> = ({
  label, size = 68, color, children,
}) => (
  <div style={{flex: "0 0 auto", width: size, height: size, borderRadius: "50%",
    background: color ?? "linear-gradient(160deg, #3a4f7c, #1f2b47)", border: "2px solid rgba(255,255,255,0.22)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.46, fontWeight: 900}}>
    {children ?? label.slice(0, 1)}
  </div>
);

/** Spring progress that starts at `at` (0 before it). */
export const useAppear = (at: number, damping = 14, mass = 0.6) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - at, fps, config: {damping, mass}});
};
