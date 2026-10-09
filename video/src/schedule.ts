// Frame schedules shared by the scene components and the SFX track in Short.tsx, so every
// pop/ding lands exactly when its bubble, tick or banner appears. All frames are scene-relative.

import {SceneProps} from "./types";

const fr = (ms: number, fps: number) => Math.round((ms / 1000) * fps);

/**
 * n beats spread over the narration: the first at `first`, the last no later than 85% of the
 * speech (and at least 0.8 s before the scene ends) so the final item is on screen while it is read.
 */
export const beats = (scene: SceneProps, n: number, fps: number, first = 8): number[] => {
  if (n <= 0) return [];
  const total = fr(scene.durationMs, fps);
  const end = Math.max(first + 1, Math.min(fr(scene.leadInMs + scene.speechMs * 0.85, fps), total - fr(800, fps)));
  const step = n > 1 ? (end - first) / (n - 1) : 0;
  return Array.from({length: n}, (_, k) => Math.round(first + k * step));
};

export type ChatBeat = {typingFrom: number | null; showAt: number};

/** Chat: each bubble gets a beat; "them" bubbles are preceded by typing dots. */
export const chatBeats = (scene: SceneProps, fps: number): ChatBeat[] => {
  const msgs = scene.messages ?? [];
  const typing = msgs.length > 1 ? Math.min(fr(600, fps), Math.max(8, (fr(scene.speechMs, fps) / msgs.length) * 0.45)) : 14;
  return beats(scene, msgs.length, fps, 6 + typing).map((at, k) =>
    msgs[k].from === "them" ? {typingFrom: Math.max(0, at - typing), showAt: at} : {typingFrom: null, showAt: at},
  );
};

export const SMS_ARRIVE = 8; // the message bubble lands
export const SMS_FLAG = 24; // the "의심 링크" tag appears
export const ALERT_LAND = 12; // the banner settles (ding)
export const STAT_COUNT = [6, 40] as const; // the number counts up between these frames

/** Checklist: items slide in quickly, then get ticked one by one over the narration. */
export const checklistTicks = (scene: SceneProps, fps: number) => beats(scene, (scene.items ?? []).length, fps, 18);

/** Timeline: one step per beat; the rail draws down to each new step. */
export const timelineBeats = (scene: SceneProps, fps: number) => beats(scene, (scene.steps ?? []).length, fps, 6);
