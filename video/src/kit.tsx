import React from "react";
import {interpolate, useCurrentFrame} from "remotion";
import {Anchor, Face, fade, fadeOut, IN_AT, IN_DUR, MORPH, spr, useMorphIn, useScene} from "./motion";
import {muted, Theme, useTheme} from "./themes";
import {SceneProps} from "./types";

export const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;

// Vertical zones (px) shared by the mockup layouts. The top bar/disclaimer sit above HEADER_TOP,
// captions start at 1255, and the bottom 20% + right rail belong to YouTube's own buttons.
export const HEADER_TOP = 248;
export const HEADER_H = 262;
export const BODY_TOP = 530;
export const BODY_BOTTOM = 1200;

export const TEXT = "#F3F6FB";
// Surface colours (panel, bubbles, muted text, avatar) come from the theme (themes.ts).

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

/**
 * Corner brackets (a viewfinder frame) around the parent box, used by the "brackets" headline treatment to
 * frame the icon chip/badge (a fixed-size box, so the frame always hugs it). `p` 0..1 draws them in from
 * slightly outside.
 */
export const Brackets: React.FC<{p: number; color: string; inset?: [number, number]; size?: number; weight?: number}> = ({
  p, color, inset = [24, 16], size = 38, weight = 5,
}) => {
  const out = (1 - Math.min(1, p)) * 18;
  const [ix, iy] = [inset[0] + out, inset[1] + out];
  const b = `${weight}px solid ${color}`;
  const corner = (pos: React.CSSProperties, sides: React.CSSProperties): React.ReactNode => (
    <div style={{position: "absolute", width: size, height: size, ...pos, ...sides}} />
  );
  return (
    <div style={{position: "absolute", inset: 0, opacity: Math.min(1, p), pointerEvents: "none"}}>
      {corner({left: -ix, top: -iy}, {borderLeft: b, borderTop: b, borderTopLeftRadius: 8})}
      {corner({right: -ix, top: -iy}, {borderRight: b, borderTop: b, borderTopRightRadius: 8})}
      {corner({left: -ix, bottom: -iy}, {borderLeft: b, borderBottom: b, borderBottomLeftRadius: 8})}
      {corner({right: -ix, bottom: -iy}, {borderRight: b, borderBottom: b, borderBottomRightRadius: 8})}
    </div>
  );
};

/**
 * Style of one headline word in the theme's treatment. "marker": a highlighter band sweeps in under the lower
 * part of the word once it has landed (the band sits behind the glyphs, so the text stays white and sharp).
 */
export const markStyle = (t: Theme, accent: string, p: number): React.CSSProperties => (t.headline !== "marker" ? {} : {
  backgroundImage: `linear-gradient(${accent}80, ${accent}80)`, backgroundRepeat: "no-repeat",
  backgroundPosition: "0 94%", backgroundSize: `${Math.min(1, p) * 100}% 22%`, padding: "0 4px", margin: "0 -4px",
});

/** Headline with an icon chip, words popping in one by one, and the sub-line under it. */
export const SceneHeader: React.FC<{scene: SceneProps; top?: number; height?: number}> = ({
  scene, top = HEADER_TOP, height = HEADER_H,
}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const accent = t.accents[scene.accent];
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
  // brackets close in with the chip (after the traveller has landed when the scene morphs in)
  const frameIn = morph ? interpolate(frame, [MORPH - 2, MORPH + 7], [0, 1], clamp) : iconIn;
  return (
    <div style={{position: "absolute", top, height, left: 70, right: 70, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 18}}>
      <div style={{display: "flex", alignItems: "center", gap: 26, maxWidth: 940}}>
        <div style={{position: "relative", flex: "0 0 auto", opacity: Math.min(1, iconIn),
          transform: `scale(${0.4 + 0.6 * iconIn})`}}>
          {t.headline === "brackets" ? (
            <Brackets p={frameIn} color={`${accent}c0`} inset={[13, 13]} size={26} weight={4} />
          ) : null}
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
                <span style={markStyle(t, accent, spr(frame, w0 + 5 + i * 2, 10, 0))}>{w}</span>
              </span>
            );
          })}
        </div>
      </div>
      {scene.sub ? (
        <div style={{fontSize: 38, fontWeight: 700, color: muted(t), textAlign: "center", opacity: subIn,
          transform: `translateY(${(1 - subIn) * 10}px)`, maxWidth: 880}}>
          {scene.sub}
        </div>
      ) : null}
    </div>
  );
};

/** Rounded "screen" panel used by the chat and SMS mockups: invented header, no real app's look. */
export const PhonePanel: React.FC<{header: React.ReactNode; children: React.ReactNode; top?: number;
  bottom?: number}> = ({header, children, top = BODY_TOP, bottom = BODY_BOTTOM}) => {
  const t = useTheme();
  return (
    <div style={{position: "absolute", top, left: 110, width: 860, height: bottom - top, borderRadius: 48,
      background: t.panel, border: "2px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
      overflow: "hidden", display: "flex", flexDirection: "column"}}>
      <div style={{flex: "0 0 auto", height: 112, display: "flex", alignItems: "center", gap: 22, padding: "0 30px",
        borderBottom: "2px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)"}}>
        <div style={{fontSize: 56, fontWeight: 700, color: muted(t), marginTop: -8}}>‹</div>
        {header}
      </div>
      {children}
    </div>
  );
};

export const Avatar: React.FC<{label: string; size?: number; color?: string; children?: React.ReactNode}> = ({
  label, size = 68, color, children,
}) => {
  const t = useTheme();
  return (
    <div style={{flex: "0 0 auto", width: size, height: size, borderRadius: "50%",
      background: color ?? `linear-gradient(160deg, ${t.avatar[0]}, ${t.avatar[1]})`,
      border: "2px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.46, fontWeight: 900}}>
      {children ?? label.slice(0, 1)}
    </div>
  );
};

/** Spring progress that starts at `at` (0 before it): the shared spring with a scene-local frame. */
export const useAppear = (at: number, dur = 14, overshoot = 0.02) => spr(useCurrentFrame(), at, dur, overshoot);
