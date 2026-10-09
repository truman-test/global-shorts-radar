import React from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import {BODY_BOTTOM, BODY_TOP, MUTED, SceneHeader, SceneShell} from "./kit";
import {spr} from "./motion";
import {timelineBeats} from "./schedule";
import {ACCENTS, SceneProps} from "./types";

const RAIL_X = 196;

/**
 * 2-4 dated steps on a vertical rail. The rail draws down to each step as it is narrated: its leading
 * edge on a fast spring, the tail of a bright streak on a slower one, so a short streak runs down the
 * rail and closes up at the new dot. The current step's dot glows, earlier ones settle back.
 */
export const TimelineScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = ACCENTS[scene.accent];
  const steps = scene.steps ?? [];
  const beats = timelineBeats(scene, fps);
  const top = BODY_TOP + 40;
  const span = BODY_BOTTOM - 40 - top;
  const gap = steps.length > 1 ? Math.min(210, span / steps.length) : 0;
  const y = (k: number) => top + k * gap + Math.max(0, (span - gap * steps.length) / 2);
  const current = beats.reduce((c, at, k) => (frame >= at ? k : c), -1);
  // rail grows from the first dot towards the newest one, arriving as the step is narrated
  const edge = (dur: number, overshoot: number) => steps.length
    ? beats.reduce((acc, at, k) =>
        k === 0 ? acc : acc + (y(k) - y(k - 1)) * Math.min(1, spr(frame, at - 9, dur, overshoot)), y(0))
    : 0;
  const railTo = edge(10, 0.01); // leading edge
  const tailFrom = Math.min(railTo, edge(18, 0)); // trailing edge of the bright streak

  return (
    <SceneShell>
      <SceneHeader scene={scene} />
      <div style={{position: "absolute", left: RAIL_X - 4, top: y(0) + 22, width: 8,
        height: Math.max(0, (steps.length ? y(steps.length - 1) : 0) - y(0)), borderRadius: 4,
        background: "rgba(255,255,255,0.1)"}} />
      <div style={{position: "absolute", left: RAIL_X - 4, top: y(0) + 22, width: 8, height: Math.max(0, railTo - y(0)),
        borderRadius: 4, background: accent, boxShadow: `0 0 18px ${accent}`}} />
      {railTo - tailFrom > 1 ? (
        <div style={{position: "absolute", left: RAIL_X - 5, top: tailFrom + 22, width: 10, height: railTo - tailFrom,
          borderRadius: 5, background: `linear-gradient(180deg, ${accent}00, #ffffff)`, boxShadow: `0 0 22px ${accent}`}} />
      ) : null}
      {steps.map((st, k) => {
        const s = spr(frame, beats[k], 13);
        const active = k === current;
        const ping = active ? ((frame - beats[k]) % 36) / 36 : 1;
        return (
          <div key={k} style={{position: "absolute", top: y(k), left: 0, right: 0}}>
            <div style={{position: "absolute", left: RAIL_X - 23, top: 0, width: 46, height: 46, borderRadius: "50%",
              background: frame >= beats[k] ? accent : "#1b2640", border: `5px solid ${frame >= beats[k] ? "#fff" : "rgba(255,255,255,0.25)"}`,
              transform: `scale(${0.6 + 0.4 * s})`, boxShadow: active ? `0 0 30px ${accent}` : "none"}} />
            {active ? (
              <div style={{position: "absolute", left: RAIL_X - 23, top: 0, width: 46, height: 46, borderRadius: "50%",
                border: `4px solid ${accent}`, opacity: 1 - ping, transform: `scale(${1 + ping * 1.2})`}} />
            ) : null}
            <div style={{position: "absolute", left: RAIL_X + 56, right: 150, top: -6, opacity: Math.min(1, s) * (active || current < 0 ? 1 : 0.62),
              transform: `translateX(${(1 - s) * 50}px)`}}>
              <div style={{display: "inline-block", fontSize: 36, fontWeight: 900, color: accent, padding: "2px 18px",
                borderRadius: 999, background: `${accent}1f`, border: `2px solid ${accent}66`}}>{st.when}</div>
              <div style={{marginTop: 10, fontSize: 52, fontWeight: 800, lineHeight: 1.22,
                color: active ? "#fff" : MUTED}}>{st.text}</div>
            </div>
          </div>
        );
      })}
    </SceneShell>
  );
};
