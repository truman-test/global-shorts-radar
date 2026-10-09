// Props produced by radar/production/remotion_render.py (Python) and rendered here.
// All times are milliseconds relative to the start of the scene.

export type Accent = "red" | "yellow" | "green" | "blue";

export type Word = {text: string; startMs: number; endMs: number};

export type CaptionPage = {startMs: number; endMs: number; words: Word[]};

export type Layout = "card" | "call" | "chat" | "sms" | "alert" | "stat" | "timeline" | "checklist";

export type ChatMessage = {from: "them" | "me"; text: string};

export type TimelineStep = {when: string; text: string};

export type SceneProps = {
  layout: Layout;
  audio: string; // path under public/, "" for silent previews
  leadInMs: number; // time before narration starts (e.g. the phone rings first)
  speechMs: number; // narration length (music is ducked while it plays)
  durationMs: number; // full scene length: lead-in + speech + tail gap
  pages: CaptionPage[];
  headline: string;
  sub: string;
  icon: string;
  accent: Accent;
  caller?: string;
  callerSub?: string;
  callLabel?: string; // e.g. "수신 전화" or "영상통화"
  chatTitle?: string; // chat: thread name, e.g. "엄마"
  messages?: ChatMessage[]; // chat: bubbles, shown one by one over the scene
  sender?: string; // sms: sender label
  smsText?: string; // sms: body; links arrive already masked ("http://●●●●.kr/…")
  appLabel?: string; // alert: generic app name ("은행 앱")
  alertText?: string; // alert: notification body
  statValue?: string; // stat: "6,581억 원" — the numeric part counts up
  statLabel?: string; // stat: what the number means
  steps?: TimelineStep[]; // timeline: 2-4 dated steps
  items?: string[]; // checklist: 2-4 actions
};

export type Music = {
  src: string; // path under public/
  volume: number; // level between lines
  duckVolume: number; // level under narration
};

export type ShortProps = {
  channel: string;
  voiceLabel?: string; // e.g. "AI 음성": the narration is machine generated (shown on screen the whole time)
  disclaimer: string;
  sfx: boolean;
  music?: Music | null;
  transition?: "continuity" | "classic"; // scene changes: shared-element morph (default) or slide/fade
  posterTailMs?: number; // the last moment shows the opening poster again (loop + thumbnail frame)
  scenes: SceneProps[];
};

export const ACCENTS: Record<Accent, string> = {
  red: "#FF5A5F",
  yellow: "#FFD23F",
  green: "#3DDC97",
  blue: "#5AA9FF",
};
