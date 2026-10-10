// Frame schedules shared by the scene components and the SFX track in Short.tsx, so every
// pop/ding lands exactly when its bubble, tick or banner appears. All frames are scene-relative.

import {ChatMessage, SceneProps} from "./types";

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

/**
 * Dialogue chat: the scene has no messages of its own, so every line with a side becomes a bubble that lands when
 * its speaker starts talking. Its beats are in speech time (frames of the audio; the first scene's visuals subtract
 * their poster lead, see dialogue.useSpeechMs).
 */
export const chatFollowsLines = (scene: SceneProps) =>
  !(scene.messages ?? []).length && (scene.lines ?? []).some((l) => l.side);

/** The chat's bubbles: its own messages, or one per dialogue line on the speaker's side. */
export const chatMessages = (scene: SceneProps): ChatMessage[] =>
  chatFollowsLines(scene)
    ? (scene.lines ?? []).filter((l) => l.side).map((l) => ({from: l.side === "me" ? "me" : "them", text: l.text}))
    : scene.messages ?? [];

/** Chat: each bubble gets a beat; "them" bubbles are preceded by typing dots. */
export const chatBeats = (scene: SceneProps, fps: number): ChatBeat[] => {
  if (chatFollowsLines(scene)) {
    const typing = fr(300, fps); // the dots fill the short gap before the other side speaks
    return (scene.lines ?? []).filter((l) => l.side).map((l) => {
      const at = fr(l.startMs, fps);
      return l.side === "them" ? {typingFrom: Math.max(0, at - typing), showAt: at} : {typingFrom: null, showAt: at};
    });
  }
  const msgs = scene.messages ?? [];
  const typing = msgs.length > 1 ? Math.min(fr(600, fps), Math.max(8, (fr(scene.speechMs, fps) / msgs.length) * 0.45)) : 14;
  return beats(scene, msgs.length, fps, 6 + typing).map((at, k) =>
    msgs[k].from === "them" ? {typingFrom: Math.max(0, at - typing), showAt: at} : {typingFrom: null, showAt: at},
  );
};

export const SMS_ARRIVE = 8; // the message bubble lands
export const SMS_FLAG = 24; // the "의심 링크" tag appears

export type SmsBeats = {arrive: number; flag: number; replies: {text: string; from: "me" | "them"; at: number}[];
  speech: boolean};

/**
 * SMS: the message lands at SMS_ARRIVE and is flagged at SMS_FLAG. In a dialogue scene (`speech`: frames in speech
 * time) it lands when the other side's first line starts, and every later line with a side adds a bubble below it
 * (the victim's replies on the right).
 */
export const smsBeats = (scene: SceneProps, fps: number): SmsBeats => {
  const sided = (scene.lines ?? []).filter((l) => l.side);
  const first = sided.findIndex((l) => l.side === "them");
  if (first < 0) return {arrive: SMS_ARRIVE, flag: SMS_FLAG, replies: [], speech: false};
  const arrive = fr(sided[first].startMs, fps);
  return {arrive, flag: arrive + (SMS_FLAG - SMS_ARRIVE), speech: true,
    replies: sided.filter((_, k) => k !== first).map((l) => ({text: l.text, from: l.side === "me" ? "me" : "them",
      at: fr(l.startMs, fps)}))};
};
export const ALERT_LAND = 12; // the banner settles (ding)
export const STAT_COUNT = [6, 40] as const; // the number counts up between these frames

/** Checklist: items slide in quickly, then get ticked one by one over the narration. */
export const checklistTicks = (scene: SceneProps, fps: number) => beats(scene, (scene.items ?? []).length, fps, 18);

/** Timeline: one step per beat; the rail draws down to each new step. */
export const timelineBeats = (scene: SceneProps, fps: number) => beats(scene, (scene.steps ?? []).length, fps, 6);

/** Compare: the two cards land at COMPARE_IN; then the check on 진짜, the cross on 가짜, the circle on its key line. */
export const COMPARE_IN = [4, 10] as const;
export const compareBeats = (scene: SceneProps, fps: number) => beats(scene, 3, fps, 22);

/**
 * Toggle: one tap per menu step, then the tap on the switch (n + 1 taps); the row zooms and gets circled
 * TOGGLE_CIRCLE frames after the switch flips.
 */
export const toggleTaps = (scene: SceneProps, fps: number) => beats(scene, (scene.path ?? []).length + 1, fps, 16);
export const TOGGLE_CIRCLE = 10;

/** Flow: one node per beat, drawn top to bottom. */
export const flowBeats = (scene: SceneProps, fps: number) => beats(scene, (scene.nodes ?? []).length, fps, 6);

/** Dots: one stage per beat (the first one shortly after the grid has appeared). */
export const dotBeats = (scene: SceneProps, fps: number) => beats(scene, (scene.stages ?? []).length, fps, 16);
