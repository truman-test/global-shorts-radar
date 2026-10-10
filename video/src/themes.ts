// Stages and the fixed brand layer.
//
// Fixed on every episode (the series' grammar): the white note card every key text sits on, the caption style,
// the semantic tones (위험 red / 주의 amber / 안전 green), the type scale, the brand chip + "AI 음성" badge, the
// disclaimer badge and the continuity transition.
// Varies per episode: the stage and the topic category colour (the one accent besides the semantic tones). A stage
// has a family (alert = 다크 경보, notebook = 종이 노트, 도치's world), a luminance (light | dark, independent of the
// family: night-lamp is a dark notebook stage), a surface (its visual group), whether 도치 is on by default, and the
// spot 도치 stands on (mascotSlot). All colours live in tokens.json, which tests/test_design_tokens.py checks for
// contrast; this module validates tokens.json at load time (a typo fails the render instead of drawing nonsense).
//
// Names match radar.production.themes (Python picks a stage + category per script and passes `theme`/`category`).
import {createContext, useContext} from "react";
import TOKENS from "./tokens.json";
import {Accent, SpeakerRole} from "./types";

export const FAMILIES = ["alert", "notebook"] as const;
export type Family = (typeof FAMILIES)[number];

export const LUMINANCES = ["light", "dark"] as const;
export type Luminance = (typeof LUMINANCES)[number];

/** Visual group of a stage (the variety rules in radar.production.themes count these). */
export const SURFACES = ["ruled", "cards", "desk", "evidence", "blueprint", "sky"] as const;
export type Surface = (typeof SURFACES)[number];

export const THEME_NAMES = ["classic", "pulse", "circuit", "scan", "aurora", "contour", "notebook", "dots", "paper",
  "graph", "night-lamp", "kraft-board", "desk-spread", "mood-sky"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** Background drawn by Backdrop.tsx (every value has a renderer there; the switch is exhaustive). */
export const PATTERNS = ["grid", "rings", "traces", "diagonal", "ribbons", "topo", "ruledDark", "matrix", "ruled",
  "graph", "lamp", "kraft", "spread", "sky"] as const;
export type Pattern = (typeof PATTERNS)[number];

/** How the key words of a headline are set off on the note card: highlighter band or hand-drawn underline. */
export type HeadlineMark = "marker" | "underline";

/** 도치's colours: "paper" on light pages, "night" (rim light) on dark ones, "sky" = night under a night sky. */
export type MascotPaletteName = "paper" | "night" | "sky";

/** Where 도치 stands on this stage: the margin column's centre and the range of its feet line. */
export type MascotSlot = {x: number; minY: number; maxY: number};

/** mood-sky: the weather drawn in the top of the page, chosen per scene from its tone. */
export type SkyState = "night" | "clouds" | "day";
export type Sky = {stops: [string, string, string]; hand: string; doodle: string};

export type Theme = {
  name: ThemeName;
  family: Family;
  luminance: Luminance;
  surface: Surface;
  mascotDefault: boolean; // 도치 on unless a scene says otherwise
  mascotPalette: MascotPaletteName;
  mascotSlot: MascotSlot;
  pattern: Pattern;
  base: string; // CSS background of the whole frame
  baseStops: string[];
  accents: Record<Accent, string>; // bright accents for glows/rings on this stage (never for text on the note card)
  ink: string; // "r,g,b" of light text inside phone panels (used with alpha)
  stageInk: string; // text drawn straight on the stage (brand chip line)
  progress: string; // the progress bar at the very top
  patternInk: number; // strongest alpha of the pattern lines
  panel: string; // phone panels
  bubble: string; // incoming message bubble
  bubbleMe: string; // outgoing message bubble (neutral, never a real messenger's colour)
  avatar: [string, string]; // avatar gradient
  wallpaper: [string, string, string]; // alert lock screen: gradient + two soft blobs
  glow: number; // opacity of the accent glows behind the scene (0 on notebook stages)
  headline: HeadlineMark;
  chip: "circle" | "rounded";
  handBacking: boolean; // handwritten accents get a paper scrap behind them (stages whose surface is not light enough)
  skies?: Record<SkyState, Sky>;
};

/* ------------------------------------------------------------------ validated registry */

const fail = (where: string, what: string): never => {
  throw new Error(`tokens.json ${where}: ${what}`);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (o: Record<string, unknown>, k: string, where: string): string =>
  typeof o[k] === "string" ? (o[k] as string) : fail(where, `"${k}" must be a string`);
const num = (o: Record<string, unknown>, k: string, where: string): number =>
  typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : fail(where, `"${k}" must be a number`);
const bool = (o: Record<string, unknown>, k: string, where: string, dflt?: boolean): boolean =>
  typeof o[k] === "boolean" ? (o[k] as boolean)
    : o[k] === undefined && dflt !== undefined ? dflt : fail(where, `"${k}" must be true or false`);
const oneOf = <T extends string>(o: Record<string, unknown>, k: string, allowed: readonly T[], where: string): T =>
  (allowed as readonly unknown[]).includes(o[k]) ? (o[k] as T) : fail(where, `"${k}" must be one of ${allowed.join(", ")}`);
const strs = (o: Record<string, unknown>, k: string, n: number, where: string): string[] => {
  const v = o[k];
  return Array.isArray(v) && v.length === n && v.every((x) => typeof x === "string") ? (v as string[])
    : fail(where, `"${k}" must be ${n} strings`);
};

const parseSkies = (v: unknown, where: string): Record<SkyState, Sky> | undefined => {
  if (v === undefined) return undefined;
  if (!isObj(v)) return fail(where, `"skies" must be an object`);
  const out = {} as Record<SkyState, Sky>;
  for (const k of ["night", "clouds", "day"] as const) {
    const s = v[k];
    if (!isObj(s)) return fail(where, `skies.${k} is missing`);
    out[k] = {stops: strs(s, "stops", 3, `${where}.skies.${k}`) as [string, string, string],
      hand: str(s, "hand", `${where}.skies.${k}`), doodle: str(s, "doodle", `${where}.skies.${k}`)};
  }
  return out;
};

const parseStage = (name: ThemeName, raw: unknown): Theme => {
  const w = `stages.${name}`;
  if (!isObj(raw)) return fail(w, "missing");
  const slot = raw.mascotSlot;
  if (!isObj(slot)) return fail(w, `"mascotSlot" must be an object`);
  const accents = raw.accents;
  if (!isObj(accents)) return fail(w, `"accents" must be an object`);
  const baseStops = strs(raw, "base", 3, w);
  const [a, b, c] = baseStops;
  const family = oneOf(raw, "family", FAMILIES, w);
  return {
    name, family, baseStops, base: `linear-gradient(180deg, ${a} 0%, ${b} 55%, ${c} 100%)`,
    luminance: oneOf(raw, "luminance", LUMINANCES, w),
    surface: oneOf(raw, "surface", SURFACES, w),
    mascotDefault: bool(raw, "mascotDefault", w),
    mascotPalette: oneOf(raw, "mascotPalette", ["paper", "night", "sky"] as const, w),
    mascotSlot: {x: num(slot, "x", `${w}.mascotSlot`), minY: num(slot, "minY", `${w}.mascotSlot`),
      maxY: num(slot, "maxY", `${w}.mascotSlot`)},
    pattern: oneOf(raw, "pattern", PATTERNS, w),
    accents: {red: str(accents, "red", w), yellow: str(accents, "yellow", w), green: str(accents, "green", w),
      blue: str(accents, "blue", w)},
    ink: str(raw, "ink", w), stageInk: str(raw, "stageInk", w), progress: str(raw, "progress", w),
    patternInk: num(raw, "patternInk", w), panel: str(raw, "panel", w), bubble: str(raw, "bubble", w),
    bubbleMe: str(raw, "bubbleMe", w), avatar: strs(raw, "avatar", 2, w) as [string, string],
    wallpaper: strs(raw, "wallpaper", 3, w) as [string, string, string], glow: num(raw, "glow", w),
    headline: oneOf(raw, "headline", ["marker", "underline"] as const, w),
    chip: oneOf(raw, "chip", ["circle", "rounded"] as const, w),
    handBacking: bool(raw, "handBacking", w, false),
    skies: parseSkies(raw.skies, w),
  };
};

const buildRegistry = (): Record<ThemeName, Theme> => {
  const stages: unknown = TOKENS.stages;
  if (!isObj(stages)) return fail("stages", "missing");
  const extra = Object.keys(stages).filter((k) => !(THEME_NAMES as readonly string[]).includes(k));
  if (extra.length) fail("stages", `unknown stage(s) ${extra.join(", ")} (add them to THEME_NAMES)`);
  const out = {} as Record<ThemeName, Theme>;
  for (const n of THEME_NAMES) out[n] = parseStage(n, stages[n]);
  return out;
};

const THEMES = buildRegistry();

export const isThemeName = (name: unknown): name is ThemeName =>
  typeof name === "string" && (THEME_NAMES as readonly string[]).includes(name);

export const themeFor = (name?: string | null): Theme => (isThemeName(name) ? THEMES[name] : THEMES.classic);

/** Exhaustiveness guard for switches over the unions above. */
export const assertNever = (x: never): never => {
  throw new Error(`unhandled value ${String(x)}`);
};

// Standalone renders (Studio sample, single scenes) default to the classic look.
export const ThemeContext = createContext<Theme>(THEMES.classic);
export const useTheme = () => useContext(ThemeContext);

/** Light text inside a phone panel in this theme's tint. */
export const muted = (t: Theme, alpha = TOKENS.brand.panelMutedAlpha) => `rgba(${t.ink},${alpha})`;

/** Corner radius of an icon chip of size `size` in this theme. */
export const chipRadius = (t: Theme, size: number) => (t.chip === "rounded" ? Math.round(size * 0.3) : size / 2);

/** 도치's notebook world: doodles, handwritten accents, ink-line card reveal, confetti finale. */
export const isNotebook = (t: Theme) => t.family === "notebook";
export const isLight = (t: Theme) => t.luminance === "light";

/**
 * mood-sky: night/rain for danger (always, so a danger label never sits on a light sky), day for safe scenes and the
 * ending, clouds for caution and plain category scenes.
 */
export const skyFor = (accent: Accent, last: boolean): SkyState =>
  accent === "red" ? "night" : last || accent === "green" ? "day" : "clouds";

/* ------------------------------------------------------------------ fixed brand layer */

/** hand: a deeper ink for handwriting straight on the stage (only danger has one: 위험! must clear 7:1 there). */
export type Tone = {label: string; fill: string; ink: string; solid: string; onSolid: string; tint: string;
  marker: string; hand?: string};

export type CategoryName = "ai" | "security" | "smishing" | "voice";

export const TONES = TOKENS.tones as Record<"danger" | "caution" | "safe", Tone>;
export const CATEGORIES = TOKENS.categories as Record<CategoryName, Tone>;
export const NOTE = TOKENS.note;
export const CAPTION = TOKENS.caption;
export const TYPE = TOKENS.type;
export const BRAND = TOKENS.brand;

/** 도치's colours (tokens.json "mascot"). rimWidth 0 = no rim light. */
export type MascotPalette = {ink: string; spike: string; spikeDark: string; face: string; ear: string; sweat: string;
  shadow: string; rim: string; rimWidth: number};
const parsePalette = (k: "paper" | "night"): MascotPalette => {
  const raw: unknown = TOKENS.mascot[k];
  const w = `mascot.${k}`;
  if (!isObj(raw)) return fail(w, "missing");
  return {ink: str(raw, "ink", w), spike: str(raw, "spike", w), spikeDark: str(raw, "spikeDark", w),
    face: str(raw, "face", w), ear: str(raw, "ear", w), sweat: str(raw, "sweat", w), shadow: str(raw, "shadow", w),
    rim: str(raw, "rim", w), rimWidth: num(raw, "rimWidth", w)};
};
export const MASCOT_PALETTES = {paper: parsePalette("paper"), night: parsePalette("night")};

/** Dialogue speaker chips (tokens.json "speakers"): label on a solid pill with a light ring, per role. */
export type SpeakerChip = {bg: string; text: string; ring: string};
const parseChip = (k: SpeakerRole): SpeakerChip => {
  const raw: unknown = (TOKENS.speakers as Record<string, unknown>)[k];
  const w = `speakers.${k}`;
  if (!isObj(raw)) return fail(w, "missing");
  return {bg: str(raw, "bg", w), text: str(raw, "text", w), ring: str(raw, "ring", w)};
};
export const SPEAKER_CHIPS: Record<SpeakerRole, SpeakerChip> = {scammer: parseChip("scammer"),
  victim: parseChip("victim"), neutral: parseChip("neutral"), narrator: parseChip("narrator"), dochi: parseChip("dochi")};

/** The palette 도치 wears in a scene of this tone on this stage. */
export const mascotPaletteFor = (t: Theme, accent: Accent, last: boolean): "paper" | "night" =>
  t.mascotPalette === "sky" ? (skyFor(accent, last) === "night" ? "night" : "paper") : t.mascotPalette;

export const categoryFor = (name?: string | null): CategoryName =>
  name && name in CATEGORIES ? (name as CategoryName) : "security";

export const CategoryContext = createContext<CategoryName>("security");
export const useCategory = () => useContext(CategoryContext);

/** Scene accent -> tone: red/yellow/green are the semantic tones, blue is the episode's category colour. */
export const toneOf = (accent: Accent, category: CategoryName): Tone =>
  accent === "red" ? TONES.danger : accent === "yellow" ? TONES.caution : accent === "green" ? TONES.safe
    : CATEGORIES[category];

export const useTone = (accent: Accent): Tone => toneOf(accent, useCategory());

/**
 * Ink for things drawn straight on the stage next to the note card (handwritten labels, doodles): the tone's ink and
 * the note ink on light surfaces; the sky's light inks when mood-sky shows its night sky behind them.
 */
export const stageInks = (t: Theme, accent: Accent, last: boolean, tone: Tone): {hand: string; doodle: string} => {
  const sky = t.skies?.[skyFor(accent, last)];
  return {hand: sky?.hand || tone.hand || tone.ink, doodle: sky?.doodle || NOTE.ink};
};

/** Episode seed for deterministic per-episode variants (Python passes `seed`; else a hash of the episode id). */
export const SeedContext = createContext<number>(0);
export const useSeed = () => useContext(SeedContext);
