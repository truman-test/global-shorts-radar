import React from "react";
import {interpolate, useCurrentFrame} from "remotion";
import {DoodleProp} from "./Doodles";
import {clamp, Headline, NoteCard, useShell} from "./kit";
import {Anchor, Face, MORPH, spr, useMorphIn} from "./motion";
import {chipRadius, NOTE, TYPE, useTheme, useTone} from "./themes";
import {SceneProps} from "./types";

export const BADGE = 270;

/** Poster headline size: two lines of the note card at most. */
const posterSize = (headline: string) => {
  const n = headline.replace(/\s/g, "").length;
  return n <= 14 ? TYPE.poster : n <= 18 ? 96 : 88;
};

/**
 * Explainer card (also the poster when it opens the video): the icon badge springs in and floats above the note
 * card, the headline words pop in one by one on the card and the key phrase gets the stage's mark.
 */
export const CardScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const tone = useTone(scene.accent);
  const shell = useShell("swipe");
  const morph = useMorphIn();
  const iconIn = morph ? 1 : spr(frame, 2, 13, 0.04);
  // the traveller measures the badge on screen, so the float needs no special case
  const float = Math.sin(frame / 13) * 8;
  const pulse = (frame % 45) / 45;
  const ringIn = morph ? interpolate(frame, [MORPH, MORPH + 8], [0, 1], clamp) : 1;
  const words = scene.headline.split(" ");
  const cardIn = morph ? 1 : spr(frame, 0, 14, 0.01);
  // everything has landed by the poster frame (POSTER = 24) for headlines of up to ~6 words
  const subIn = interpolate(frame, [6 + words.length * 2, 12 + words.length * 2], [0, 1], clamp);

  return (
    <div style={{position: "absolute", inset: 0, ...shell}}>
      {/* icon badge */}
      <div style={{position: "absolute", left: 540 - BADGE / 2, top: 390, width: BADGE, height: BADGE,
        transform: `translateY(${float}px) scale(${0.3 + 0.7 * iconIn})`, opacity: Math.min(1, iconIn)}}>
        <div style={{position: "absolute", inset: 0, borderRadius: chipRadius(t, BADGE), border: `5px solid ${tone.fill}`,
          opacity: 0.6 * (1 - pulse) * ringIn, transform: `scale(${1 + pulse * 0.42})`}} />
        <Anchor size={BADGE} style={{position: "absolute", inset: 0}}>
          <Face look={{kind: "chip", icon: scene.icon, accent: scene.accent}} size={BADGE} glow={60} />
        </Anchor>
      </div>
      {/* paper stage: two line-art props of the episode's topic draw themselves around the badge */}
      {t.family === "paper" ? (
        <>
          <DoodleProp which={0} x={858} y={520} size={150} at={4} tilt={8} />
          <DoodleProp which={1} x={250} y={452} size={118} at={7} tilt={-8} />
        </>
      ) : null}
      {/* the note card with the headline */}
      <NoteCard box={{top: 712, left: 64, right: 64, opacity: Math.min(1, cardIn * 1.3),
        transform: `translateY(${(1 - cardIn) * 40}px)`}} fold={56}>
        <div style={{padding: scene.sub ? "46px 56px 40px" : "52px 56px 56px", display: "flex", flexDirection: "column",
          alignItems: "center", gap: 26}}>
          <Headline text={scene.headline} mark={scene.mark} size={posterSize(scene.headline)} tone={tone} theme={t}
            start={2} step={2} rise={40} />
          {scene.sub ? (
            <div style={{fontSize: 42, fontWeight: TYPE.weights.text, color: NOTE.muted, opacity: subIn, lineHeight: 1.25,
              transform: `translateY(${(1 - subIn) * 14}px)`, textAlign: "center", maxWidth: 820}}>
              {scene.sub}
            </div>
          ) : null}
        </div>
      </NoteCard>
    </div>
  );
};
