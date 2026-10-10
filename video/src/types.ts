// Props produced by radar/production/remotion_render.py (Python) and rendered here.
// All times are milliseconds relative to the start of the scene.

export type Accent = "red" | "yellow" | "green" | "blue";

export type Word = {text: string; startMs: number; endMs: number};

export type CaptionPage = {startMs: number; endMs: number; words: Word[]};

export type Layout = "card" | "call" | "chat" | "sms" | "alert" | "stat" | "timeline" | "checklist" | "compare"
  | "toggle" | "flow" | "dots";

export type ChatMessage = {from: "them" | "me"; text: string};

export type TimelineStep = {when: string; text: string};

/** compare: one side of the 진짜 vs 가짜 split. */
export type CompareSide = {label: string; title: string; points: string[]};

/** flow: one node of the decision chart; `yes`/`no` (at most one) branches to the side, the chain goes down. */
export type FlowNode = {text: string; yes?: string; no?: string};

/** dots: one stage of the dot simulation (a funnel: each count <= the previous one). */
export type DotStage = {label: string; count: number};

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
  mark?: string; // the headline's key phrase (a substring) that gets the highlighter / underline
  real?: CompareSide; // compare: the genuine side (green check)
  fake?: CompareSide; // compare: the fake side (red cross, its key line circled)
  path?: string[]; // toggle: 1-3 menu steps tapped through, e.g. ["보안", "결제 인증"]
  setting?: string; // toggle: the switch's row label
  toggleTo?: "on" | "off"; // toggle: the state the switch is flipped to
  nodes?: FlowNode[]; // flow: 3-5 nodes drawn top to bottom
  total?: number; // dots: how many people the grid stands for
  stages?: DotStage[]; // dots: 2-4 stages
  unit?: string; // dots: counter unit, default "명"
  mascot?: boolean; // 도치 the hedgehog mascot in this scene; default: the stage's mascotDefault (on for notebook stages)
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
  theme?: string; // stage theme (themes.ts / tokens.json): background family + pattern; default classic
  category?: string; // topic category (tokens.json categories): the brand chip label and the one accent colour
  episode?: string; // script id (deterministic per-episode variants of the stage; never random at render time)
  seed?: number; // CRC32 of the episode id, computed in Python (wins over a hash of `episode`)
  episodeNo?: number; // series number (position in content/schedule.json): the "생존노트 #N" chip in the brand line
  shareLine?: string; // handwritten under the closing checklist only, e.g. "부모님께도 보내 주세요" (visual only)
  cta?: string; // value chip with a bell in the last ~1.2 s before the poster tail, e.g. "매일 1장, 생존노트"
  scenes: SceneProps[];
};

export const ACCENTS: Record<Accent, string> = {
  red: "#FF5A5F",
  yellow: "#FFD23F",
  green: "#3DDC97",
  blue: "#5AA9FF",
};
