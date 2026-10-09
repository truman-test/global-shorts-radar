import React from "react";
import {interpolate, useCurrentFrame} from "remotion";
import {Anchor, Face, fade, fadeOut, IN_AT, IN_DUR, spr, useMorphIn, useScene} from "./motion";
import {SceneProps} from "./types";

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

export const CHIP = 98; // header icon chip (outer size), the shared element of the mockup layouts

export type ShellStyle = "slide" | "swipe" | "fade";

/**
 * Enter/exit of a whole scene. Classic: each layout's own slide/swipe/fade in, fade out over the last
 * 7 frames. Continuity: no movement, the content only crossfades around the boundary while the shared
 * element (icon chip / avatar) travels between scenes (see Traveller in Short.tsx).
 */
export const useShell = (style: ShellStyle): React.CSSProperties => {
  const frame = useCurrentFrame();
  const s = useScene();
  const cont = s.mode === "continuity";
  const classicExit = interpolate(frame, [s.frames - 7, s.frames], [1, 0], clamp);
  const exit = cont && !s.last ? fadeOut(frame, s.frames) : classicExit;
  if (cont && !s.first) return {opacity: exit * fade(frame, IN_AT, IN_DUR)};
  if (style === "swipe") {
    const e = spr(frame, 0, 14, 0.01);
    return {opacity: exit, transform: `translateX(${(1 - e) * 120}px) scale(${0.97 + 0.03 * e})`};
  }
  if (style === "fade") return {opacity: exit * Math.min(1, spr(frame, 0, 16))};
  const e = spr(frame, 0, 16, 0);
  return {opacity: exit * Math.min(1, e * 1.4), transform: `translateY(${(1 - e) * 60}px)`};
};

export const SceneShell: React.FC<{children: React.ReactNode; style?: ShellStyle}> = ({children, style = "slide"}) => (
  <div style={{position: "absolute", inset: 0, ...useShell(style)}}>{children}</div>
);

/** Headline with an icon chip, words popping in one by one, and the sub-line under it. */
export const SceneHeader: React.FC<{scene: SceneProps; top?: number; height?: number}> = ({
  scene, top = HEADER_TOP, height = HEADER_H,
}) => {
  const frame = useCurrentFrame();
  const morph = useMorphIn();
  const words = scene.headline.split(" ");
  // keep long headlines to two lines so they never reach the disclaimer badge or the mockup
  const n = scene.headline.replace(/\s/g, "").length;
  const size = n <= 13 ? 70 : n <= 18 ? 64 : n <= 24 ? 58 : 50;
  // the chip arrives with the traveller when the scene morphs in; otherwise it pops in itself
  const iconIn = morph ? 1 : spr(frame, 1, 12, 0.04);
  // when the chip flies in, the words wait until it has nearly landed so they never appear under it
  const w0 = morph ? 8 : 3;
  const subIn = interpolate(frame, [w0 + 5 + words.length * 2, w0 + 15 + words.length * 2], [0, 1], clamp);
  return (
    <div style={{position: "absolute", top, height, left: 70, right: 70, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 18}}>
      <div style={{display: "flex", alignItems: "center", gap: 26, maxWidth: 940}}>
        <div style={{flex: "0 0 auto", opacity: Math.min(1, iconIn), transform: `scale(${0.4 + 0.6 * iconIn})`}}>
          <Anchor size={CHIP}>
            <Face look={{kind: "chip", icon: scene.icon, accent: scene.accent}} size={CHIP} glow={36} />
          </Anchor>
        </div>
        <div style={{fontSize: size, fontWeight: 900, lineHeight: 1.16, letterSpacing: -1.5,
          textWrap: "balance" as React.CSSProperties["textWrap"]}}>
          {words.map((w, i) => {
            const s = spr(frame, w0 + i * 2, 12);
            return (
              <span key={i} style={{display: "inline-block", marginRight: size * 0.24, opacity: Math.min(1, s),
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

/** Spring progress that starts at `at` (0 before it): the shared spring with a scene-local frame. */
export const useAppear = (at: number, dur = 14, overshoot = 0.02) => spr(useCurrentFrame(), at, dur, overshoot);
