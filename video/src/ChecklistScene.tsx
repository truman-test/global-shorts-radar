import React from "react";
import {interpolateColors, useCurrentFrame, useVideoConfig} from "remotion";
import {handCheck, drawn, seedOf} from "./hand";
import {BODY_BOTTOM, BODY_TOP, NoteCard, SceneHeader, SceneShell} from "./kit";
import {spr} from "./motion";
import {checklistTicks} from "./schedule";
import {NOTE, useTone} from "./themes";
import {SceneProps} from "./types";

const ROW_H = 132;
const PAD_Y = 30;
const BOX = 72;

/**
 * The closing checklist note (a fixed signature of every episode): rows slide in together, then each item is
 * ticked as it is narrated. A soft highlight travels to the row being ticked with its leading edge on a fast
 * spring and its trailing edge on a slower one; the box fills on the fast spring and a hand-drawn check follows.
 */
export const ChecklistScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tone = useTone(scene.accent);
  const items = scene.items ?? [];
  const ticks = checklistTicks(scene, fps);
  const height = items.length * ROW_H + PAD_Y * 2;
  const top = BODY_TOP + Math.max(0, (BODY_BOTTOM - BODY_TOP - height) / 2) - 10;
  // the highlight sets off a few frames early so its leading edge reaches the row with the tick
  const lead = (k: number) => spr(frame, ticks[k] - 3, 9);
  const trail = (k: number) => spr(frame, ticks[k] - 3, 17, 0);
  const hlTop = PAD_Y + 10 + ticks.slice(1).reduce((a, _, j) => a + ROW_H * trail(j + 1), 0);
  const hlBottom = PAD_Y + ROW_H - 10 + ticks.slice(1).reduce((a, _, j) => a + ROW_H * lead(j + 1), 0);
  const hlWidth = items.length ? 22 + BOX + (860 - 40 - 22 - BOX) * lead(0) : 0;

  return (
    <SceneShell>
      <SceneHeader scene={scene} />
      <NoteCard box={{top, left: 110, width: 860, height}} fold={50}>
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
                <div style={{fontSize: 48, fontWeight: 800, lineHeight: 1.2,
                  color: interpolateColors(f, [0, 1], [NOTE.muted, NOTE.ink])}}>{text}</div>
              </div>
            );
          })}
        </div>
      </NoteCard>
    </SceneShell>
  );
};
