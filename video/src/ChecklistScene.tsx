import React from "react";
import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {BODY_BOTTOM, BODY_TOP, clamp, MUTED, PANEL, SceneHeader, SceneShell} from "./kit";
import {checklistTicks} from "./schedule";
import {ACCENTS, SceneProps} from "./types";

const ROW_H = 132;

/** Action checklist: rows slide in together, then each box is ticked (stroke drawn) as it is narrated. */
export const ChecklistScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = ACCENTS[scene.accent];
  const items = scene.items ?? [];
  const ticks = checklistTicks(scene, fps);
  const height = items.length * ROW_H + 60;
  const top = BODY_TOP + Math.max(0, (BODY_BOTTOM - BODY_TOP - height) / 2) - 10;

  return (
    <SceneShell>
      <SceneHeader scene={scene} />
      <div style={{position: "absolute", top, left: 110, width: 860, height, borderRadius: 44, background: PANEL,
        border: "2px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", padding: "30px 44px"}}>
        {items.map((text, k) => {
          const slide = spring({frame: frame - (4 + k * 4), fps, config: {damping: 16, mass: 0.6}});
          const tick = spring({frame: frame - ticks[k], fps, config: {damping: 12, mass: 0.5}});
          const draw = interpolate(frame, [ticks[k], ticks[k] + 9], [0, 1], clamp);
          const done = frame >= ticks[k];
          return (
            <div key={k} style={{height: ROW_H, display: "flex", alignItems: "center", gap: 34, opacity: slide,
              transform: `translateX(${(1 - slide) * 80}px)`,
              borderTop: k ? "2px solid rgba(255,255,255,0.07)" : "none"}}>
              <div style={{flex: "0 0 auto", width: 76, height: 76, borderRadius: 22,
                border: `5px solid ${done ? accent : "rgba(255,255,255,0.35)"}`, background: done ? accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transform: `scale(${done ? 1 + 0.16 * Math.sin(Math.min(1, tick) * Math.PI) : 1})`,
                boxShadow: done ? `0 0 ${24 * tick}px ${accent}aa` : "none"}}>
                <svg width={52} height={52} viewBox="0 0 24 24">
                  <path d="M4.5 12.5l5 5L19.5 7" fill="none" stroke="#0b1324" strokeWidth={3.6} strokeLinecap="round"
                    strokeLinejoin="round" strokeDasharray={24} strokeDashoffset={24 * (1 - draw)} />
                </svg>
              </div>
              <div style={{fontSize: 50, fontWeight: 800, lineHeight: 1.2, color: done ? "#fff" : MUTED}}>{text}</div>
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
};
