import React from "react";
import {interpolateColors, useCurrentFrame, useVideoConfig} from "remotion";
import {BODY_BOTTOM, BODY_TOP, MUTED, PANEL, SceneHeader, SceneShell} from "./kit";
import {spr} from "./motion";
import {checklistTicks} from "./schedule";
import {ACCENTS, SceneProps} from "./types";

const ROW_H = 132;
const PAD_Y = 30;
const BOX = 76;

/**
 * Action checklist: rows slide in together, then each item is ticked as it is narrated. A soft
 * highlight travels to the row being ticked with its leading edge on a fast spring and its trailing
 * edge on a slower one (it stretches, then settles); the box fills on the fast spring and the check
 * stroke draws on the slow one.
 */
export const ChecklistScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = ACCENTS[scene.accent];
  const items = scene.items ?? [];
  const ticks = checklistTicks(scene, fps);
  const height = items.length * ROW_H + 60;
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
      <div style={{position: "absolute", top, left: 110, width: 860, height, borderRadius: 44, background: PANEL,
        border: "2px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", padding: `${PAD_Y}px 44px`}}>
        {items.length ? (
          <div style={{position: "absolute", left: 20, top: hlTop, width: hlWidth, height: hlBottom - hlTop,
            borderRadius: 30, background: `${accent}1c`, border: `2px solid ${accent}40`,
            opacity: Math.min(1, lead(0) * 1.5)}} />
        ) : null}
        {items.map((text, k) => {
          const slide = spr(frame, 4 + k * 4, 13, 0.01);
          const fill = spr(frame, ticks[k], 8, 0.04); // leading: the box fills
          const draw = Math.min(1, spr(frame, ticks[k] + 2, 12, 0)); // trailing: the stroke follows
          const f = Math.min(1, fill);
          return (
            <div key={k} style={{position: "relative", height: ROW_H, display: "flex", alignItems: "center", gap: 34,
              opacity: Math.min(1, slide), transform: `translateX(${(1 - slide) * 80}px)`,
              borderTop: k ? "2px solid rgba(255,255,255,0.07)" : "none"}}>
              <div style={{position: "relative", flex: "0 0 auto", width: BOX, height: BOX, borderRadius: 22,
                border: `5px solid ${interpolateColors(f, [0, 1], ["rgba(255,255,255,0.35)", accent])}`,
                boxSizing: "content-box", display: "flex", alignItems: "center", justifyContent: "center",
                transform: `scale(${1 + 0.14 * Math.sin(f * Math.PI)})`, boxShadow: `0 0 ${24 * f}px ${accent}aa`}}>
                <div style={{position: "absolute", inset: -1, borderRadius: 18, background: accent,
                  transform: `scale(${fill})`, opacity: f > 0 ? 1 : 0}} />
                <svg width={52} height={52} viewBox="0 0 24 24" style={{position: "relative"}}>
                  <path d="M4.5 12.5l5 5L19.5 7" fill="none" stroke="#0b1324" strokeWidth={3.6} strokeLinecap="round"
                    strokeLinejoin="round" strokeDasharray={24} strokeDashoffset={24 * (1 - draw)} />
                </svg>
              </div>
              <div style={{fontSize: 50, fontWeight: 800, lineHeight: 1.2,
                color: interpolateColors(f, [0, 1], [MUTED, "#ffffff"])}}>{text}</div>
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
};
