import React from "react";
import {interpolate, useCurrentFrame} from "remotion";
import {Brackets, clamp, markStyle, useShell} from "./kit";
import {Anchor, Face, MORPH, spr, useMorphIn} from "./motion";
import {chipRadius, muted, useTheme} from "./themes";
import {SceneProps} from "./types";

export const BADGE = 270;

/** Explainer card: icon badge springs in and floats, headline words pop in one by one, accent rule grows. */
export const CardScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const shell = useShell("swipe");
  const morph = useMorphIn();
  const accent = t.accents[scene.accent];
  const iconIn = morph ? 1 : spr(frame, 2, 13, 0.04);
  // the traveller measures the badge on screen, so the float needs no special case
  const float = Math.sin(frame / 13) * 8;
  const pulse = (frame % 45) / 45;
  const ringIn = morph ? interpolate(frame, [MORPH, MORPH + 8], [0, 1], clamp) : 1;
  const words = scene.headline.split(" ");
  const ruleIn = spr(frame, 6 + words.length * 3, 16, 0);
  const subIn = interpolate(frame, [10 + words.length * 3, 22 + words.length * 3], [0, 1], clamp);
  const headlineWords = words.map((w, i) => {
    const s = spr(frame, 4 + i * 3, 13, 0.03);
    return (
      <span key={i} style={{display: "inline-block", marginRight: 26, opacity: Math.min(1, s),
        transform: `translateY(${(1 - s) * 40}px) scale(${0.85 + 0.15 * s})`,
        textShadow: "0 8px 30px rgba(0,0,0,0.6)"}}>
        <span style={markStyle(t, accent, spr(frame, 9 + i * 3, 10, 0))}>{w}</span>
      </span>
    );
  });

  return (
    <div style={{position: "absolute", inset: 0, ...shell}}>
      {/* icon badge */}
      <div style={{position: "absolute", left: 540 - BADGE / 2, top: 400, width: BADGE, height: BADGE,
        transform: `translateY(${float}px) scale(${0.3 + 0.7 * iconIn})`, opacity: Math.min(1, iconIn)}}>
        <div style={{position: "absolute", inset: 0, borderRadius: chipRadius(t, BADGE), border: `4px solid ${accent}`,
          opacity: 0.6 * (1 - pulse) * ringIn, transform: `scale(${1 + pulse * 0.45})`}} />
        {t.headline === "brackets" ? (
          // viewfinder frame around the badge (in after the traveller has landed when the scene morphs in)
          <Brackets p={ringIn} color={`${accent}b0`} inset={[34, 34]} size={58} weight={6} />
        ) : null}
        <Anchor size={BADGE} style={{position: "absolute", inset: 0}}>
          <Face look={{kind: "chip", icon: scene.icon, accent: scene.accent}} size={BADGE} glow={60} />
        </Anchor>
      </div>
      {/* headline */}
      <div style={{position: "absolute", top: 760, left: 90, right: 90, textAlign: "center", fontSize: 104,
        fontWeight: 900, lineHeight: 1.2, letterSpacing: -2, textWrap: "balance" as React.CSSProperties["textWrap"]}}>
        {headlineWords}
      </div>
      {/* accent rule + sub */}
      <div style={{position: "absolute", top: 1035, width: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 26}}>
        {t.headline === "rule" ? (
          <div style={{width: 200 * ruleIn, height: 12, borderRadius: 6, background: accent,
            boxShadow: `0 0 24px ${accent}`}} />
        ) : <div style={{height: 12}} />}
        {scene.sub ? (
          <div style={{fontSize: 46, fontWeight: 700, color: muted(t, 0.9), opacity: subIn,
            transform: `translateY(${(1 - subIn) * 14}px)`, padding: "0 110px", textAlign: "center"}}>
            {scene.sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};
