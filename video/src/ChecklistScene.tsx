import React from "react";
import {interpolate, interpolateColors, useCurrentFrame, useVideoConfig} from "remotion";
import {handCheck, drawn, seedOf} from "./hand";
import {Handwrite} from "./Handwriting";
import {BODY_BOTTOM, BODY_TOP, clamp, markedWords, NoteCard, SceneHeader, SceneShell, useBody} from "./kit";
import {spr, useScene} from "./motion";
import {rng} from "./hand";
import {checklistTicks} from "./schedule";
import {CATEGORIES, isLight, isNotebook, NOTE, stageInks, TONES, useCategory, useTheme, useTone} from "./themes";
import {SceneProps} from "./types";

const ROW_H = 132;
// handwriting under the card: the sign-off and the share line, both kept above the caption band (1255)
const HAND_LIMIT = 1240;
const SIGN = {size: 78, h: 92};
const SHARE = {size: 64, h: 72}; // line box + the slight tilt
const PAD_Y = 30;
const BOX = 72;

/**
 * Two short bursts of paper flecks from the card's side edges at frame `at` (drawn behind the card, so they never
 * cover text): seeded, gravity, gone within ~1.3 s and kept above the captions.
 */
const Confetti: React.FC<{at: number; y: number; left: number; right: number; colors: string[]}> = ({
  at, y, left, right, colors,
}) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 40) return null;
  const r = rng(4242);
  return (
    <svg width={1080} height={1920} style={{position: "absolute", inset: 0, pointerEvents: "none"}}>
      {Array.from({length: 24}, (_, k) => {
        const side = k % 2 ? 1 : -1;
        const x = side > 0 ? right + 5 : left - 5;
        const ang = -Math.PI / 2 + side * (0.35 + r() * 0.9);
        const v = 15 + r() * 15;
        const spin = (r() - 0.5) * 30;
        const px = x + Math.cos(ang) * (34 + v * t * 0.9);
        const py = y + Math.sin(ang) * (34 + v * t * 0.9) + 0.55 * t * t;
        const c = colors[k % colors.length];
        const op = Math.min(1, (40 - t) / 10) * (py < 1230 ? 1 : 0);
        return <rect key={k} x={px - 7} y={py - 4} width={14} height={8} rx={2} fill={c} opacity={op}
          transform={`rotate(${spin * t} ${px} ${py})`} />;
      })}
    </svg>
  );
};

/** Screen y of the centre of checklist row k (the mascot walks the margin beside it). */
export const checklistRowY = (scene: SceneProps, k: number) => {
  const height = (scene.items ?? []).length * ROW_H + PAD_Y * 2;
  const top = BODY_TOP + Math.max(0, (BODY_BOTTOM - BODY_TOP - height) / 2) - 10;
  return top + PAD_Y + k * ROW_H + ROW_H / 2;
};

/**
 * The closing checklist note (a fixed signature of every episode): rows slide in together, then each item is
 * ticked as it is narrated. A soft highlight travels to the row being ticked with its leading edge on a fast
 * spring and its trailing edge on a slower one; the box fills on the fast spring and a hand-drawn check follows.
 */
export const ChecklistScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tone = useTone(scene.accent);
  const t = useTheme();
  const s = useScene();
  const cat = useCategory();
  const items = scene.items ?? [];
  const ticks = checklistTicks(scene, fps);
  const height = items.length * ROW_H + PAD_Y * 2;
  const top = BODY_TOP + Math.max(0, (BODY_BOTTOM - BODY_TOP - height) / 2) - 10;
  // the highlight sets off a few frames early so its leading edge reaches the row with the tick
  const lead = (k: number) => spr(frame, ticks[k] - 3, 9);
  const trail = (k: number) => spr(frame, ticks[k] - 3, 17, 0);
  const hlTop = PAD_Y + 10 + ticks.slice(1).reduce((a, _, j) => a + ROW_H * trail(j + 1), 0);
  const hlBottom = PAD_Y + ROW_H - 10 + ticks.slice(1).reduce((a, _, j) => a + ROW_H * lead(j + 1), 0);
  const body = useBody();
  const hlWidth = items.length ? 22 + BOX + (body.width - 40 - 22 - BOX) * lead(0) : 0;

  // notebook stages, closing scene: the page warms up as the list fills, a few confetti flecks on the final tick
  const finale = isNotebook(t) && s.last && items.length > 0;
  const lastTick = ticks[items.length - 1] ?? 0;
  const marked = markedWords(scene.headline, scene.mark);
  const signOff = scene.headline.split(" ").filter((_, i) => marked.has(i)).join(" ");
  const warm = finale ? interpolate(frame, [lastTick - 30, lastTick + 12], [0, 1], clamp) : 0;
  // Under the card: the sign-off (notebook stages) and the share line (closing scene, every stage). Both if they fit
  // above the captions; when space is tight the share line replaces the sign-off.
  const bottom = top + height;
  const share = s.last && items.length ? s.share : undefined;
  const signFits = finale && bottom + 16 + SIGN.h <= HAND_LIMIT;
  const both = signFits && !!share && bottom + 16 + SIGN.h + 8 + SHARE.h <= HAND_LIMIT;
  const shareY = both ? bottom + 16 + SIGN.h + 8 : bottom + 16;
  const showShare = !!share && shareY + SHARE.h <= HAND_LIMIT;
  const showSign = signFits && (!showShare || both);
  // written once the first item is ticked (a calm moment, and ~4 s on screen), never in the final beat
  const shareAt = Math.min((ticks[0] ?? 0) + 16, s.frames - 45);
  return (
    <SceneShell>
      {warm > 0 ? (
        <div style={{position: "absolute", inset: 0, opacity: warm * (isLight(t) ? 1 : 0.6), mixBlendMode: isLight(t) ? "multiply" : "soft-light",
          background: "radial-gradient(ellipse 90% 70% at 50% 45%, rgba(255,214,150,0.30), rgba(255,170,110,0.22))"}} />
      ) : null}
      <SceneHeader scene={scene} />
      {finale ? <Confetti at={lastTick + 2} left={body.left} right={body.left + body.width} y={top + PAD_Y + (items.length - 1) * ROW_H + ROW_H / 2}
        colors={[tone.fill, TONES.caution.fill, CATEGORIES[cat].fill, "#FF8FA3"]} /> : null}
      <NoteCard box={{top, left: body.left, width: body.width, height}} fold={50}>
        {items.length ? (
          <div style={{position: "absolute", left: 20, top: hlTop, width: hlWidth, height: hlBottom - hlTop,
            borderRadius: 26, background: tone.tint, opacity: Math.min(1, lead(0) * 1.5)}} />
        ) : null}
        <div style={{position: "relative", padding: `${PAD_Y}px 44px`}}>
          {items.map((text, k) => {
            const slide = spr(frame, 4 + k * 4, 13, 0.01);
            const fill = spr(frame, ticks[k], 8, 0.04); // leading: the box fills
            const draw = Math.min(1, spr(frame, ticks[k] + 2, 12, 0)); // trailing: the check follows
            const f = Math.min(1, fill);
            const check = handCheck(52, seedOf(text));
            return (
              <div key={k} style={{position: "relative", height: ROW_H, display: "flex", alignItems: "center", gap: 32,
                opacity: Math.min(1, slide), transform: `translateX(${(1 - slide) * 80}px)`,
                borderTop: k ? `2px dashed ${NOTE.rule}` : "none"}}>
                <div style={{position: "relative", flex: "0 0 auto", width: BOX, height: BOX, borderRadius: 20,
                  border: `5px solid ${interpolateColors(f, [0, 1], [NOTE.faint, tone.fill])}`,
                  boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
                  transform: `scale(${1 + 0.12 * Math.sin(f * Math.PI)})`}}>
                  <div style={{position: "absolute", inset: -1, borderRadius: 16, background: tone.fill,
                    transform: `scale(${fill})`, opacity: f > 0 ? 1 : 0}} />
                  <svg width={52} height={52} style={{position: "relative", overflow: "visible"}}>
                    <path {...drawn(check, draw)} stroke={NOTE.ink} strokeWidth={7} />
                  </svg>
                </div>
                <div style={{fontSize: body.width < 800 ? 44 : 48, fontWeight: 800, lineHeight: 1.2,
                  color: interpolateColors(f, [0, 1], [NOTE.muted, NOTE.ink])}}>{text}</div>
              </div>
            );
          })}
        </div>
      </NoteCard>
      {/* the sign-off: the headline's key phrase, handwritten under the list next to 도치 (only if it fits above
          the captions) */}
      {showSign ? (
        <Handwrite text={signOff} x={body.left + 24} y={bottom + 16} size={SIGN.size}
          color={stageInks(t, scene.accent, s.last, tone).hand} underline={tone.fill}
          at={lastTick + 12} dur={14} rotate={-3} />
      ) : null}
      {/* the share line (ask to pass the list on to family): the page's own ink on notebook stages (their surface under
          the card is paper, also under night-lamp's lamp), the stage's light ink on the dark alert stages (no 도치) */}
      {showShare && share ? (
        <Handwrite text={share} x={body.left + 24} y={shareY} size={SHARE.size}
          color={isNotebook(t) ? NOTE.ink : t.stageInk} at={shareAt} dur={16} rotate={-2} />
      ) : null}
    </SceneShell>
  );
};
