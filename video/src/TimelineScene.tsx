import React from "react";
import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {BODY_BOTTOM, BODY_TOP, clamp, MUTED, SceneHeader, SceneShell} from "./kit";
import {timelineBeats} from "./schedule";
import {ACCENTS, SceneProps} from "./types";

const RAIL_X = 196;

/**
 * 2-4 dated steps on a vertical rail. The rail draws down to each step as it is narrated; the
 * current step's dot glows, earlier ones settle back.
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
  // rail grows from the first dot towards the newest one
  const railTo = steps.length
    ? beats.reduce((acc, at, k) => {
        if (k === 0) return y(0);
        const p = interpolate(frame, [at - 8, at + 2], [0, 1], clamp);
        return acc + (y(k) - y(k - 1)) * p;
      }, y(0))
    : 0;

  return (
    <SceneShell>
      <SceneHeader scene={scene} />
      <div style={{position: "absolute", left: RAIL_X - 4, top: y(0) + 22, width: 8,
        height: Math.max(0, (steps.length ? y(steps.length - 1) : 0) - y(0)), borderRadius: 4,
        background: "rgba(255,255,255,0.1)"}} />
      <div style={{position: "absolute", left: RAIL_X - 4, top: y(0) + 22, width: 8, height: Math.max(0, railTo - y(0)),
        borderRadius: 4, background: accent, boxShadow: `0 0 18px ${accent}`}} />
      {steps.map((st, k) => {
        const s = spring({frame: frame - beats[k], fps, config: {damping: 14, mass: 0.6}});
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
            <div style={{position: "absolute", left: RAIL_X + 56, right: 150, top: -6, opacity: s * (active || current < 0 ? 1 : 0.62),
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
