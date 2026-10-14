// Props produced by radar/production/remotion_render.py (Python) and rendered here.
// All times are milliseconds relative to the start of the scene.

export type Accent = "red" | "yellow" | "green" | "blue";

export type Word = {text: string; startMs: number; endMs: number};

/** A page of words on screen; in a dialogue scene it carries its speaker (cast id) and the line it belongs to. */
export type CaptionPage = {startMs: number; endMs: number; words: Word[]; speaker?: string; line?: number};

/** Dialogue roles: the caption chip colour and the side of the phone mockup (victim = the phone's owner). "inner" is
 * a character's inner voice (속마음): a second cast entry with the same `character` as another member; its lines are
 * played as an aside to the camera (CastScene AsideShot), never on the phone. */
export type SpeakerRole = "scammer" | "victim" | "narrator" | "dochi" | "neutral" | "inner";

/** On-screen characters (Character.tsx rigs; composition.json "characters"). "ad" is the voice of an on-screen ad,
 * drawn as an invented presenter inside the TV frame of watch_ad. */
export type CharacterId = "father" | "mother" | "daughter" | "son" | "scammer" | "fake_banker" | "ad";

/** The cast's skin over the same rig and stagings (composition.json "castStyles"): drawn humans (Character.tsx) or
 * our animal cast (Animal.tsx: 진돗개 family, 여우 callers). Default human. */
export type CastStyle = "human" | "animal";

/** Character expressions (the 8 of the brief + "excited", the lured look). */
export type Expression = "neutral" | "worried" | "shocked" | "panicked" | "relieved" | "suspicious" | "smug" | "fakeKind"
  | "excited";

/** Arm/hand poses of a character. */
export type Gesture = "rest" | "phoneEar" | "phoneRead" | "phoneType" | "handOnHead" | "handsOnCheeks" | "point"
  | "palmOut" | "clutchChest";

/** How a dialogue scene is staged with characters (CastScene.tsx); default from the layout (rig.ts stagingOf). */
export type Staging = "pip_call" | "split_call" | "solo" | "over_shoulder_chat" | "watch_ad" | "twist_closeup"
  | "dochi_explains";

/** A cast member as the renderer needs it: the chip label ("" = no chip), its role and mockup side, and the
 * character rig that plays it (none = voice only). */
export type CastMember = {label: string; role: SpeakerRole; side?: "me" | "them"; character?: CharacterId;
  costume?: CostumeId};

/** The fox's disguise per scam (script cast "costume", callers only; composition.json "costumes"): the same fox under
 * a different outfit, and the disguise never quite hides him (an ear through the hat, a crooked moustache, the tail).
 * Animal skin only; the human skin keeps the caller's usual look. No cast costume = the character's usual look. */
export type CostumeId = "hoodie" | "bank_suit" | "investigator" | "courier" | "guru" | "lecturer" | "family_mask";

/** Where the caller is (script / scene "villain_set"; composition.json "villainSets"): the room behind every caller
 * shot (call window, caller and aside shots, the twist close-up on the fox, the cold open) and its foreground prop. */
export type VillainSet = "callcentre" | "fake_office" | "studio" | "car" | "lecture_room";

/** One spoken line of a dialogue scene (scene time, lead-in included). Optional acting notes: the speaker's face and
 * gesture, and a keyword speech bubble (<= 8 characters, a part of the line's text). `spike`: 도치 the 가시 감지기 pops
 * in with its spikes up on this line (true = a third into the line; a word of the line = as that word is spoken). */
export type SpokenLine = {speaker: string; text: string; startMs: number; endMs: number; side?: "me" | "them";
  face?: Expression; gesture?: Gesture; bubble?: string; spike?: boolean | string};

/** The reveal: at atMs the scene's frame freezes and a hand-drawn stamp lands on it. */
/** on: cast id in the twist close-up (default the victim); face: its expression (default "shocked"). */
export type Twist = {text: string; atMs: number; on?: string; face?: string};

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
  lines?: SpokenLine[]; // dialogue: who speaks when (the mockup and 도치 react to the active speaker)
  twist?: Twist; // the reveal stamp over a freeze-frame at the scene's end
  staging?: Staging; // dialogue with characters: the staging template (Python picks the default from the layout)
  set?: HomeSetName; // drama: the family's room in this scene (Sets.tsx HomeSet), default living
  posterProp?: PosterProp; // drama: an evidence prop beside the character of a solo shot (Props.tsx)
  villainSet?: VillainSet; // drama: the caller's room in this scene (Sets.tsx VillainSetView), default callcentre
};

/** The family's room of a drama scene (script "set"): the living room or the side-dish shop (반찬가게). */
export type HomeSetName = "living" | "shop";

/** Evidence props for the hook frame (script scene "poster_prop"), generic and invented: no agency, logo or number. */
export type PosterProp = "mail_notice";

/** The closing scoreboard (script "score"): the standing after this episode; the winner's number ticks up to it. */
export type Score = {home: number; fox: number; winner?: "home" | "fox"};

/**
 * The flash-forward (script "cold_open", ColdOpen.tsx): the video opens on the twist scene `scene` frozen a moment
 * after its stamp (with `stamp`), the exclamation (`audio`, `pages`) plays from 0.0 s; holdMs later an 8-frame rewind
 * wipes to the story, which starts at durationMs; a `label` chip ("몇 분 전") follows. Poster tail = this frame.
 */
export type ColdOpen = {audio: string; speechMs: number; holdMs: number; durationMs: number; pages: CaptionPage[];
  lines?: SpokenLine[]; scene: number; speaker?: string; stamp?: string; label?: string};

export type Music = {
  src: string; // path under public/
  volume: number; // level between lines
  duckVolume: number; // level under narration
};

export type Packaging = "drama" | "explainer";

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
  cast?: Record<string, CastMember>; // dialogue speakers (only when a scene has lines)
  castStyle?: CastStyle; // skin of the rigged characters (script cast_style); default human
  // Packaging: "drama" (a skit played by rigged characters) drops the brand line, category / series chips, CTA, share
  // line and the 재연 pill for one small disclosure chip and a fixed situation title; "explainer" is the notebook look.
  // Default: drama when a scene is staged by characters (rig.ts isDrama), else explainer.
  packaging?: Packaging;
  hookTitle?: string | string[]; // drama: the fixed top situation title, 1-2 lines (a string breaks at "\n")
  disclosure?: string; // drama: the disclosure chip, default "재연 · AI 음성"
  seriesChip?: string; // drama: the small chip above the title box, e.g. "여우의 영업비밀 #3" (script series + ep)
  score?: Score; // drama: the scoreboard that the series chip turns into in the last 1.2 s (before the tail)
  coldOpen?: ColdOpen; // drama: the flash-forward before the story (it shifts every scene by its durationMs)
  scenes: SceneProps[];
};

export const ACCENTS: Record<Accent, string> = {
  red: "#FF5A5F",
  yellow: "#FFD23F",
  green: "#3DDC97",
  blue: "#5AA9FF",
};
