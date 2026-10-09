// Shared motion vocabulary: one closed-form spring for every entrance, and the scene context that
// tells layouts how they enter/leave ("classic" slide/fade or "continuity" shared-element morph).
import React, {createContext, useContext} from "react";
import {useCurrentFrame} from "remotion";
import {Icon} from "./icons";
import {chipRadius, toneOf, useCategory, useTheme} from "./themes";
import {Accent} from "./types";

export type Transition = "continuity" | "classic";

/**
 * Damped spring from rest (0) to 1, computed purely from the frame (no state between frames).
 * `dur` is roughly the settle time in frames; `overshoot` is the peak above 1 (0 = critically damped).
 * The default 2% overshoot is just enough to feel physical without bouncing.
 */
export const spr = (frame: number, at = 0, dur = 14, overshoot = 0.02): number => {
  const t = frame - at;
  if (t <= 0) return 0;
  if (overshoot <= 0) {
    const w = 6.64 / dur;
    return 1 - Math.exp(-w * t) * (1 + w * t);
  }
  const l = Math.log(overshoot);
  const zeta = -l / Math.sqrt(Math.PI * Math.PI + l * l);
  const w = 4.6 / (zeta * dur);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
};

/** Same spring, clamped to [0, 1] for opacities. */
export const fade = (frame: number, at = 0, dur = 10) => Math.min(1, Math.max(0, spr(frame, at, dur, 0)));

// Continuity timing (frames, relative to the scene boundary).
export const MORPH = 12; // the shared element travels from scene N's anchor to scene N+1's
export const OUT = 6; // the rest of scene N fades out over this many frames after the boundary
export const IN_AT = 2; // scene N+1's content starts fading in this many frames after the boundary
export const IN_DUR = 9;

export type SceneCtx = {mode: Transition; index: number; frames: number; first: boolean; last: boolean};

// Standalone renders (Studio sample, stills) behave like the classic single scene.
export const SceneContext = createContext<SceneCtx>({mode: "classic", index: 0, frames: 1e9, first: true, last: true});
export const useScene = () => useContext(SceneContext);

/** True when this scene morphs in from the previous one (its own entrance is replaced by the traveller). */
export const useMorphIn = () => {
  const s = useScene();
  return s.mode === "continuity" && !s.first;
};

/**
 * Outgoing scene opacity after its boundary `at`: the same spring, but it reaches exactly 0 a few frames
 * in. A long near-zero tail is not invisible: Chrome boosts faint text, so a 1% headline reads as ~9%.
 */
export const fadeOut = (frame: number, at: number) => Math.max(0, 1 - fade(frame, at, OUT) / 0.88) ** 1.5;

/** The shared element's look: an accent icon chip, or the caller's avatar on the call screen. */
export type Look = {kind: "chip"; icon: string; accent: Accent} | {kind: "avatar"; letter: string};

/** Everything needed to draw a scene's shared element at its natural size. */
export type AnchorSpec = {look: Look; size: number; glow?: number};

export const Face: React.FC<AnchorSpec> = ({look, size, glow}) => {
  const t = useTheme();
  const category = useCategory();
  if (look.kind === "avatar") {
    return (
      <div style={{width: size, height: size, borderRadius: "50%", background: `linear-gradient(160deg, ${t.avatar[0]}, ${t.avatar[1]})`,
        border: `${Math.max(3, size / 70)}px solid rgba(255,255,255,0.25)`, boxSizing: "border-box", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: size * 0.46, fontWeight: 900, color: "#fff"}}>
        {look.letter}
      </div>
    );
  }
  // a light "sticker" in the scene's tone: reads the same on the note card, dark stages and paper
  const tone = toneOf(look.accent, category);
  // `glow` (the old accent halo) is only kept for card badges on dark stages, softly
  const halo = glow && t.glow > 0 ? `, 0 0 ${glow}px ${tone.fill}55` : "";
  return (
    <div style={{width: size, height: size, borderRadius: chipRadius(t, size), background: tone.tint,
      border: `${Math.max(3, Math.round(size / 26))}px solid ${tone.fill}`, boxSizing: "border-box",
      boxShadow: `0 ${Math.round(size / 18)}px ${Math.round(size / 7)}px rgba(20,24,35,0.18)${halo}`,
      display: "flex", alignItems: "center", justifyContent: "center"}}>
      <Icon name={look.icon} size={Math.round(size * 0.54)} color={tone.ink} />
    </div>
  );
};

/**
 * Marks a scene's shared element. In continuity mode it hides while the traveller (Short.tsx) is
 * standing in for it: from the scene's end onwards, and during the first MORPH frames of a scene
 * that morphs in.
 */
export const Anchor: React.FC<{size: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
  size, children, style,
}) => {
  const frame = useCurrentFrame();
  const s = useScene();
  const hidden = s.mode === "continuity" && ((!s.first && frame < MORPH) || (!s.last && frame >= s.frames));
  return (
    <div data-anchor={s.index} data-size={size} style={{width: size, height: size, ...style,
      visibility: hidden ? "hidden" : undefined}}>
      {children}
    </div>
  );
};
