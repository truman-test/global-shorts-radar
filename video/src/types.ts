// Props produced by radar/production/remotion_render.py (Python) and rendered here.
// All times are milliseconds relative to the start of the scene.

export type Accent = "red" | "yellow" | "green" | "blue";

export type Word = {text: string; startMs: number; endMs: number};

export type CaptionPage = {startMs: number; endMs: number; words: Word[]};

export type SceneProps = {
  layout: "card" | "call";
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
};

export type Music = {
  src: string; // path under public/
  volume: number; // level between lines
  duckVolume: number; // level under narration
};

export type ShortProps = {
  channel: string;
  disclaimer: string;
  sfx: boolean;
  music?: Music | null;
  scenes: SceneProps[];
};

export const ACCENTS: Record<Accent, string> = {
  red: "#FF5A5F",
  yellow: "#FFD23F",
  green: "#3DDC97",
  blue: "#5AA9FF",
};
