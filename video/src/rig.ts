// Character system, pure part: which staging a scene uses, which shot is on screen at a moment, who is acting how
// (expression, gesture, talking mouth, blink). Every value is a function of the speech clock (ms) and the props, never
// of state between frames, so any frame renders on its own (stills, the poster tail, parallel render workers).
import COMP from "./composition.json";
import {activeLine} from "./dialogue";
import {CastMember, CaptionPage, CharacterId, Expression, Gesture, SceneProps, SpokenLine, Staging} from "./types";

export const RIG = COMP.rig;
export const FRAME = COMP.frame;
export const CHARACTERS = COMP.characters as CharacterId[];
export const STAGINGS = COMP.stagings as Staging[];
export const EXPRESSIONS = COMP.expressions as Expression[];
export const GESTURES = COMP.gestures as Gesture[];
export const SPEC = COMP.stagings_spec;

export type Who = "victim" | "caller" | "other" | "presenter";
export type CharSpot = {who: Who; x: number; eyeY: number; k: number; turn?: number; view?: string; gestures: string[];
  mirror?: boolean};

/** Neck position of a character placed by its eye line (see composition.json "_doc"). */
export const neckY = (eyeY: number, k: number) => eyeY - RIG.eyeY * k;

/* ------------------------------------------------------------------ deterministic noise */

/** Integer hash -> [0, 1). */
export const hash01 = (a: number, b = 0) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const strSeed = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

/**
 * Eyelids 0 (open) .. 1 (closed): a blink every 2.5-4.5 s (seeded per character), 4 frames (half, closed, closed-ish,
 * half). Pure: the blink times are rebuilt from the seed up to `frame`.
 */
export const blinkAt = (frame: number, seed: number, fps = 30) => {
  if (frame < 0) return 0;
  let t = Math.round(hash01(seed, 99) * 2 * fps);
  for (let k = 0; t <= frame; k++) {
    const d = frame - t;
    if (d < 4) return [0.55, 1, 0.8, 0.35][d];
    t += Math.round((2.5 + 2 * hash01(seed, k)) * fps);
  }
  return 0;
};

/* ------------------------------------------------------------------ lip sync from the word timings */

const HANGUL0 = 0xac00;

/**
 * Mouth shape of a Hangul syllable from its vowel (jungseong): 1 small/flat (ㅡ ㅣ ㅢ), 2 mid (ㅓ ㅔ ㅕ ㅖ ㅐ),
 * 3 wide open (ㅏ ㅑ ㅘ), 4 round (ㅗ ㅛ ㅜ ㅠ ㅝ ㅚ ㅟ ...). Non-Hangul characters (digits, letters) get 2.
 */
export const visemeOf = (ch: string): number => {
  const c = ch.charCodeAt(0) - HANGUL0;
  if (c < 0 || c > 11171) return /[0-9A-Za-z]/.test(ch) ? 2 : 0;
  const v = Math.floor(c / 28) % 21;
  if ([0, 2, 9].includes(v)) return 3; // ㅏ ㅑ ㅘ
  if ([1, 3, 4, 5, 6, 7, 10, 15].includes(v)) return 2; // ㅐ ㅒ ㅓ ㅔ ㅕ ㅖ ㅙ ㅞ
  if ([18, 19, 20].includes(v)) return 1; // ㅡ ㅢ ㅣ
  return 4; // ㅗ ㅚ ㅛ ㅜ ㅝ ㅟ ㅠ
};

/** Lips close at the end of a syllable with a final ㅁ / ㅂ / ㅍ. */
const closesLips = (ch: string) => {
  const c = ch.charCodeAt(0) - HANGUL0;
  if (c < 0 || c > 11171) return false;
  return [16, 17, 26].includes(c % 28);
};

/**
 * The mouth shape 0..4 of `speaker` at `ms`: the word being spoken (caption pages carry the per-word times and the
 * speaker), split evenly into its syllables; each syllable opens to its vowel's shape and closes briefly at its edges
 * (and fully on a final ㅁ/ㅂ/ㅍ), so the lips flap at the syllable rate (~5-8 Hz). 0 between words and lines.
 */
export const mouthAt = (pages: CaptionPage[], speaker: string, ms: number): number => {
  const page = pages.find((p) => p.speaker === speaker && ms >= p.startMs - 40 && ms < p.endMs);
  if (!page) return 0;
  const word = page.words.find((w) => ms >= w.startMs && ms < w.endMs);
  if (!word) return 0;
  const syl = [...word.text].filter((ch) => /[가-힣0-9A-Za-z]/.test(ch));
  if (!syl.length) return 0;
  // the voice ends a little before the word's slot does (pauses at commas/periods sit in the slot)
  const span = (word.endMs - word.startMs) * (/[,.?!]$/.test(word.text) ? 0.82 : 0.95);
  const p = (ms - word.startMs) / Math.max(60, span);
  if (p >= 1) return 0;
  const i = Math.min(syl.length - 1, Math.floor(p * syl.length));
  const f = p * syl.length - i;
  const shape = visemeOf(syl[i]);
  if (f > 0.72 && closesLips(syl[i])) return 0;
  if (f < 0.16 || f > 0.86) return shape === 3 ? 2 : 1; // opening / closing between syllables
  return shape;
};

/* ------------------------------------------------------------------ cast and staging */

export const characterOf = (cast: Record<string, CastMember>, speaker?: string): CharacterId | undefined =>
  speaker ? cast[speaker]?.character : undefined;

const FAMILY = new Set<string>(COMP.family);
const CALLERS = new Set<string>(COMP.callers);
export const isFamily = (c?: CharacterId) => Boolean(c && FAMILY.has(c));
export const isCaller = (c?: CharacterId) => Boolean(c && CALLERS.has(c));

/** The victim: the cast member with role victim and a family character (else the first family character). */
export const victimOf = (cast: Record<string, CastMember>): string | undefined => {
  const ids = Object.keys(cast);
  return ids.find((k) => cast[k].role === "victim" && isFamily(cast[k].character))
    ?? ids.find((k) => isFamily(cast[k].character));
};

/** The caller (scammer / fake banker) of a scene: a speaker of its lines with a caller character, else any. */
export const callerOf = (scene: SceneProps, cast: Record<string, CastMember>): string | undefined => {
  const speakers = (scene.lines ?? []).map((l) => l.speaker);
  return speakers.find((s) => isCaller(cast[s]?.character))
    ?? Object.keys(cast).find((k) => isCaller(cast[k].character));
};

/** Another family member who speaks in this scene (the daughter of "엄마, 누르지 마!"). */
export const otherOf = (scene: SceneProps, cast: Record<string, CastMember>, victim?: string): string | undefined =>
  (scene.lines ?? []).map((l) => l.speaker).find((s) => s !== victim && isFamily(cast[s]?.character));

/** The ad's voice (watch_ad): a speaker drawn as the presenter on the TV. */
export const adOf = (scene: SceneProps, cast: Record<string, CastMember>): string | undefined =>
  (scene.lines ?? []).map((l) => l.speaker).find((s) => cast[s]?.character === "ad");

/**
 * The staging of a scene: its own (Python passes it, defaulted from the layout), else the same default here so plain
 * props render too: a dialogue scene whose speakers include a rigged character is staged by its layout (call ->
 * pip_call, chat/sms -> over_shoulder_chat, a card with an ad voice -> watch_ad). Explainers stay unstaged unless the
 * script asks for dochi_explains.
 */
export const stagingOf = (scene: SceneProps, cast: Record<string, CastMember>): Staging | undefined => {
  if (scene.staging) return scene.staging;
  const lines = scene.lines ?? [];
  if (!lines.some((l) => cast[l.speaker]?.character)) return undefined;
  if (scene.layout === "call") return "pip_call";
  if (scene.layout === "chat" || scene.layout === "sms") return "over_shoulder_chat";
  if (scene.layout === "card" && lines.some((l) => cast[l.speaker]?.character === "ad")) return "watch_ad";
  return undefined;
};

/** Stagings that replace the layout's picture with characters (dochi_explains keeps the layout, reframed). */
export const isDrama = (s?: Staging) => Boolean(s && s !== "dochi_explains");

/* ------------------------------------------------------------------ shots */

export type Shot = {name: string; startMs: number; endMs: number};

/** When the twist close-up cuts in: a few frames before the stamp lands (the face reacts, then the flash). */
export const TWIST_LEAD_MS = 170;
export const twistCutMs = (scene: SceneProps) => (scene.twist ? scene.twist.atMs - TWIST_LEAD_MS : Infinity);

const MIN_SHOT = 520;
const SPLIT_OVER = 3000; // a line longer than this gets a cut in its middle

/** Merge too-short shots into their neighbour and same-name neighbours into one. */
const tidy = (shots: Shot[]): Shot[] => {
  const out: Shot[] = [];
  for (const s of shots) {
    if (s.endMs - s.startMs <= 0) continue;
    const last = out[out.length - 1];
    if (last && (last.name === s.name || s.endMs - s.startMs < MIN_SHOT)) {
      last.endMs = s.endMs;
      continue;
    }
    if (last && last.endMs - last.startMs < MIN_SHOT && out.length > 1) {
      out[out.length - 2].endMs = last.endMs;
      out.pop();
      const prev = out[out.length - 1];
      if (prev.name === s.name) {
        prev.endMs = s.endMs;
        continue;
      }
    }
    out.push({...s});
  }
  return out;
};

/**
 * The shot list of a staged scene (speech ms; the first shot starts at -inf so the poster frame is covered, the last
 * ends at +inf). Cuts land on line starts (and in the middle of long lines), alternating framings so the picture
 * changes every 1.5-3 s; the twist close-up takes over before the stamp.
 */
export const planShots = (scene: SceneProps, cast: Record<string, CastMember>, staging: Staging, posterMs = 0
): Shot[] => {
  const lines = scene.lines ?? [];
  const victim = victimOf(cast);
  const shots: Shot[] = [];
  const starts = lines.map((l) => l.startMs);
  const until = (i: number) => (i + 1 < lines.length ? starts[i + 1] : 1e9);
  const first = lines.length ? Math.max(starts[0], posterMs) : 1e9;
  // the opening scene holds its poster shot (the victim's face) for posterMs: no cut in the first second
  const push = (name: string, a: number, b: number) =>
    shots.push({name, startMs: shots.length ? Math.max(a, first) : a, endMs: b});
  switch (staging) {
    case "pip_call": {
      // the opening scene opens on the extreme close-up (the poster); later scenes on the close-up
      push(posterMs > 0 ? "hook" : "close", -1e9, first);
      const rot = {caller: ["wide", "caller", "wide", "close"], victim: ["close", "wide"]};
      let kc = 0;
      let kv = 0;
      // a family member in the room with the victim (the daughter of "엄마, 이거 사기야!") gets her own shot
      const other = otherOf(scene, cast, victim);
      lines.forEach((l, i) => {
        if (l.speaker === other) {
          push("other", l.startMs, until(i));
          return;
        }
        const caller = l.speaker !== victim;
        const pick = () => (caller ? rot.caller[kc++ % rot.caller.length] : rot.victim[kv++ % rot.victim.length]);
        const end = until(i);
        if (l.endMs - l.startMs > SPLIT_OVER) {
          const mid = (l.startMs + l.endMs) / 2;
          push(pick(), l.startMs, mid);
          push(pick(), mid, end);
        } else {
          push(pick(), l.startMs, end);
        }
      });
      break;
    }
    case "over_shoulder_chat": {
      const other = otherOf(scene, cast, victim);
      const caller = callerOf(scene, cast);
      push("face", -1e9, first);
      lines.forEach((l, i) => {
        const end = until(i);
        const dur = l.endMs - l.startMs;
        if (l.speaker === victim) {
          const faceTo = dur > 2200 ? l.startMs + 1500 : end;
          push("face", l.startMs, faceTo);
          push("over", faceTo, end);
          return;
        }
        const solo = l.speaker === other ? "other" : l.speaker === caller && cast[l.speaker]?.character ? "caller" : "";
        const soloTo = solo ? Math.min(l.startMs + 1500, l.endMs - (dur > 2000 ? 700 : 0)) : l.startMs;
        if (solo) push(solo, l.startMs, soloTo);
        const nextIsVictim = i + 1 < lines.length && lines[i + 1].speaker === victim;
        if (!nextIsVictim && l.endMs + SPEC.over_shoulder_chat.reactionMs < end) {
          push("over", soloTo, l.endMs);
          push("face", l.endMs, l.endMs + SPEC.over_shoulder_chat.reactionMs);
          push("over", l.endMs + SPEC.over_shoulder_chat.reactionMs, end);
        } else if (!nextIsVictim && i + 1 >= lines.length) {
          push("over", soloTo, l.endMs);
          push("face", l.endMs, end);
        } else {
          push("over", soloTo, end);
        }
      });
      break;
    }
    case "watch_ad": {
      push("face", -1e9, first);
      const ad = adOf(scene, cast);
      lines.forEach((l, i) => {
        const end = until(i);
        if (l.speaker === ad) {
          const mid = Math.min(l.endMs, l.startMs + Math.max(1400, (l.endMs - l.startMs) * 0.55));
          push("tv", l.startMs, mid);
          push("wide", mid, end);
        } else {
          push("face", l.startMs, end);
        }
      });
      break;
    }
    case "solo": {
      const caller = callerOf(scene, cast);
      push("victim", -1e9, first);
      lines.forEach((l, i) => push(l.speaker === victim ? "victim" : l.speaker === caller ? "caller" : "other",
        l.startMs, until(i)));
      break;
    }
    case "split_call":
      push("split", -1e9, 1e9);
      break;
    case "twist_closeup":
      push("twist", -1e9, 1e9);
      break;
    case "dochi_explains":
      push("explain", -1e9, 1e9);
      break;
  }
  if (!shots.length) push(Object.keys(SPEC[staging].shots)[0], -1e9, 1e9);
  shots[shots.length - 1].endMs = 1e9;
  let out = tidy(shots);
  const cut = twistCutMs(scene);
  if (Number.isFinite(cut) && staging !== "dochi_explains") {
    out = out.filter((s) => s.startMs < cut).map((s) => ({...s, endMs: Math.min(s.endMs, cut)}));
    out.push({name: "twist", startMs: cut, endMs: 1e9});
  }
  out[0].startMs = -1e9;
  return out;
};

export const shotAt = (shots: Shot[], ms: number): Shot =>
  shots.find((s) => ms >= s.startMs && ms < s.endMs) ?? shots[shots.length - 1];

/** The spec of a shot (the twist shot of any staging is twist_closeup's). */
export const shotSpec = (staging: Staging, name: string) => {
  if (name === "twist") return SPEC.twist_closeup.shots.twist as {chars: CharSpot[]};
  const shots = SPEC[staging].shots as Record<string, {chars: CharSpot[]}>;
  return shots[name] ?? Object.values(shots)[0];
};

/* ------------------------------------------------------------------ acting */

export type Acting = {expr: Expression; gesture: Gesture; talking: boolean; mouth: number; free?: Gesture};

/** The face a line is spoken with: the script's note, else the character's habit, else from the punctuation. */
export const lineFace = (line: SpokenLine, member?: CastMember): Expression => {
  if (line.face) return line.face;
  const c = member?.character;
  if (c === "scammer") return "smug";
  if (c === "fake_banker" || c === "ad") return "fakeKind";
  if (line.text.includes("!")) return "shocked";
  if (line.text.includes("?")) return "suspicious";
  return "neutral";
};

/** How a character listens when it is not talking (before its first line of the scene). */
const restingFace = (who: Who, staging: Staging, c?: CharacterId): Expression => {
  if (c === "scammer") return "smug";
  if (c === "fake_banker" || c === "ad") return "fakeKind";
  if (who === "victim" && (staging === "pip_call" || staging === "split_call")) return "worried";
  if (who === "victim" && staging === "watch_ad") return "excited"; // the lure: sparkle in the eyes
  return "neutral";
};

/**
 * What a character does at `ms`: speaking its own line (that line's face, the lips from the word timings, a talking
 * gesture), or listening (the face of its last line, a strong face fading to worried after a moment; a family voice
 * shouting "!" makes the listener flinch to shocked; the victim worries under a caller's pressure).
 */
export const actingAt = (scene: SceneProps, cast: Record<string, CastMember>, id: string | undefined, who: Who,
  staging: Staging, ms: number, baseGesture: Gesture): Acting => {
  const lines = scene.lines ?? [];
  const member = id ? cast[id] : undefined;
  const c = member?.character;
  const k = activeLine(lines, ms);
  const line = k >= 0 ? lines[k] : undefined;
  if (line && id && line.speaker === id) {
    return {expr: lineFace(line, member), gesture: line.gesture ?? baseGesture, talking: true,
      mouth: mouthAt(scene.pages, id, ms)};
  }
  let expr = restingFace(who, staging, c);
  let gesture = baseGesture;
  const own = id ? lines.filter((l) => l.speaker === id && l.endMs <= ms) : [];
  const last = own[own.length - 1];
  if (last) {
    const f = lineFace(last, member);
    const strong = f === "shocked" || f === "panicked";
    expr = strong && ms - last.endMs > 1100 ? "worried" : f;
    if (last.gesture && ms - last.endMs < 600) gesture = last.gesture;
  }
  if (line && who !== "caller" && who !== "presenter") {
    const by = cast[line.speaker];
    if (isFamily(by?.character) && line.text.includes("!")) expr = "shocked";
    else if (isCaller(by?.character) && who === "victim" && !last && staging !== "watch_ad") expr = "worried";
  }
  return {expr, gesture, talking: false, mouth: 0};
};

/** The speaker of the line active at `ms` (or of the last line started), for the active-speaker emphasis. */
export const speakerAt = (scene: SceneProps, ms: number): string | undefined => {
  const lines = scene.lines ?? [];
  const k = activeLine(lines, ms);
  return k >= 0 ? lines[k].speaker : undefined;
};

/** 0..1 "this one is talking" with 6-frame (200 ms) ramps, for the active-speaker emphasis. */
export const talkWeight = (scene: SceneProps, id: string | undefined, ms: number) => {
  if (!id) return 0;
  return (scene.lines ?? []).reduce((m, l) => (l.speaker !== id ? m
    : Math.max(m, Math.min(1, (ms - l.startMs + 100) / 200, (l.endMs + 100 - ms) / 200))), 0);
};

/* ------------------------------------------------------------------ cheap camera motion (pure) */

export const MOTION = COMP.motion;

/**
 * The scene's keyword moment for the punch-in: the first line with a bubble (from its start), else the moment a line
 * says the scene's mark (the headline's key phrase), from the word that starts it. At most one per scene.
 */
export const punchOf = (scene: SceneProps): {atMs: number; endMs: number} | undefined => {
  const lines = scene.lines ?? [];
  const withBubble = lines.find((l) => bubbleOf(l));
  if (withBubble) return {atMs: withBubble.startMs, endMs: withBubble.endMs};
  const mark = scene.mark?.trim();
  if (!mark) return undefined;
  const i = lines.findIndex((l) => l.text.includes(mark));
  if (i < 0) return undefined;
  const head = mark.split(/\s+/)[0];
  const words = scene.pages.filter((p) => p.line === i || (p.line === undefined && p.speaker === lines[i].speaker
    && p.startMs >= lines[i].startMs - 50 && p.endMs <= lines[i].endMs + 400)).flatMap((p) => p.words);
  const w = words.find((x) => x.text.includes(head));
  return {atMs: w ? w.startMs : lines[i].startMs, endMs: lines[i].endMs};
};

/** Camera zoom factor of the punch-in at `ms`: 1 -> motion.punchIn over punchFrames (ease-out), held to the line's
 * end, released over releaseFrames. */
export const punchZoom = (scene: SceneProps, ms: number, fps: number) => {
  const p = punchOf(scene);
  if (!p || ms < p.atMs) return 1;
  const f = ((ms - p.atMs) / 1000) * fps;
  const inn = 1 - (1 - Math.min(1, f / MOTION.punchFrames)) ** 3;
  const r = ((ms - p.endMs) / 1000) * fps;
  const out = r <= 0 ? 1 : Math.max(0, 1 - r / MOTION.releaseFrames);
  const o = out * out * (3 - 2 * out);
  return 1 + (MOTION.punchIn - 1) * inn * o;
};

/** Camera shake (screen px) as a shocked / panicked line starts: a damped sine over shakeFrames. */
export const shockShake = (scene: SceneProps, cast: Record<string, CastMember>, ms: number, fps: number) => {
  const lines = scene.lines ?? [];
  const k = activeLine(lines, ms);
  if (k < 0) return 0;
  const l = lines[k];
  const face = lineFace(l, cast[l.speaker]);
  if (face !== "shocked" && face !== "panicked") return 0;
  const f = ((ms - l.startMs) / 1000) * fps;
  if (f < 0 || f >= MOTION.shakeFrames) return 0;
  return Math.sin(f * 2.7) * MOTION.shakePx * (1 - f / MOTION.shakeFrames);
};

/** The bubble keyword of the active line (a part of the line, at most bubbleMaxChars). */
export const bubbleOf = (line?: SpokenLine) =>
  line?.bubble && line.bubble.length <= COMP.bubbleMaxChars && line.text.includes(line.bubble) ? line.bubble : undefined;
