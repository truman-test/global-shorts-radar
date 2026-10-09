import React from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import {BODY_BOTTOM, BODY_TOP, NoteCard, SceneHeader, SceneShell} from "./kit";
import {spr} from "./motion";
import {timelineBeats} from "./schedule";
import {NOTE, useTone} from "./themes";
import {SceneProps} from "./types";

const RAIL_X = 92; // inside the card

/**
 * 2-4 dated steps on a vertical rail, written on the note card. The rail draws down to each step as it is
 * narrated: its leading edge on a fast spring, the tail of a darker streak on a slower one. The current step's
 * dot pings, earlier ones settle back.
 */
export const TimelineScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tone = useTone(scene.accent);
  const steps = scene.steps ?? [];
  const beats = timelineBeats(scene, fps);
  const cardTop = BODY_TOP + 10;
  const cardH = BODY_BOTTOM - 10 - cardTop;
  const top = 50;
  const span = cardH - 100;
  const gap = steps.length > 1 ? Math.min(200, span / steps.length) : 0;
  const y = (k: number) => top + k * gap + Math.max(0, (span - gap * steps.length) / 2);
  const current = beats.reduce((c, at, k) => (frame >= at ? k : c), -1);
  // rail grows from the first dot towards the newest one, arriving as the step is narrated
  const edge = (dur: number, overshoot: number) => steps.length
    ? beats.reduce((acc, at, k) =>
        k === 0 ? acc : acc + (y(k) - y(k - 1)) * Math.min(1, spr(frame, at - 9, dur, overshoot)), y(0))
    : 0;
  const railTo = edge(10, 0.01);
  const tailFrom = Math.min(railTo, edge(18, 0));

  return (
    <SceneShell>
      <SceneHeader scene={scene} />
      <NoteCard box={{top: cardTop, left: 110, width: 860, height: cardH}} fold={50}>
        <div style={{position: "absolute", left: RAIL_X - 4, top: y(0) + 22, width: 8,
          height: Math.max(0, (steps.length ? y(steps.length - 1) : 0) - y(0)), borderRadius: 4, background: NOTE.rule}} />
        <div style={{position: "absolute", left: RAIL_X - 4, top: y(0) + 22, width: 8, height: Math.max(0, railTo - y(0)),
          borderRadius: 4, background: tone.fill}} />
        {railTo - tailFrom > 1 ? (
          <div style={{position: "absolute", left: RAIL_X - 5, top: tailFrom + 22, width: 10, height: railTo - tailFrom,
            borderRadius: 5, background: `linear-gradient(180deg, ${tone.fill}00, ${tone.ink})`}} />
        ) : null}
        {steps.map((st, k) => {
          const s = spr(frame, beats[k], 13);
          const active = k === current;
          const reached = frame >= beats[k];
          const ping = active ? ((frame - beats[k]) % 36) / 36 : 1;
          return (
            <div key={k} style={{position: "absolute", top: y(k), left: 0, right: 0}}>
              <div style={{position: "absolute", left: RAIL_X - 23, top: 0, width: 46, height: 46, borderRadius: "50%",
                background: reached ? tone.fill : NOTE.paper, border: `5px solid ${reached ? tone.ink : NOTE.faint}`,
                boxSizing: "border-box", transform: `scale(${0.6 + 0.4 * s})`}} />
              {active ? (
                <div style={{position: "absolute", left: RAIL_X - 23, top: 0, width: 46, height: 46, borderRadius: "50%",
                  border: `4px solid ${tone.fill}`, opacity: 1 - ping, transform: `scale(${1 + ping * 1.2})`}} />
              ) : null}
              <div style={{position: "absolute", left: RAIL_X + 56, right: 50, top: -6,
                opacity: Math.min(1, s), transform: `translateX(${(1 - s) * 50}px)`}}>
                <div style={{display: "inline-block", fontSize: 34, fontWeight: 900, color: tone.ink, padding: "2px 18px",
                  borderRadius: 999, background: tone.tint}}>{st.when}</div>
                <div style={{marginTop: 10, fontSize: 48, fontWeight: 800, lineHeight: 1.22,
                  color: active ? NOTE.ink : NOTE.muted}}>{st.text}</div>
              </div>
            </div>
          );
        })}
      </NoteCard>
    </SceneShell>
  );
};
