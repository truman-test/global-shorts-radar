// Stages and the fixed brand layer.
//
// Fixed on every episode (the series' grammar): the white note card every key text sits on, the caption style,
// the semantic tones (위험 red / 주의 amber / 안전 green), the type scale, the brand chip + "AI 음성" badge, the
// disclaimer badge and the continuity transition.
// Varies per episode: the stage (background family + theme) and the topic category colour (the one accent besides
// the semantic tones). All colours live in tokens.json, which tests/test_design_tokens.py checks for contrast.
//
// Names match radar.production.themes (Python picks a stage + category per script and passes `theme`/`category`).
import {createContext, useContext} from "react";
import TOKENS from "./tokens.json";
import {Accent} from "./types";

export type Family = "alert" | "paper";

export type ThemeName = "classic" | "pulse" | "circuit" | "scan" | "aurora" | "contour" | "notebook" | "dots" | "paper"
  | "graph";

/** Background pattern drawn by Backdrop.tsx. */
export type Pattern = "grid" | "rings" | "traces" | "diagonal" | "ribbons" | "topo" | "ruledDark" | "matrix" | "ruled"
  | "graph";

/** How the key words of a headline are set off on the note card: highlighter band or hand-drawn underline. */
export type HeadlineMark = "marker" | "underline";

export type Theme = {
  name: ThemeName;
  family: Family;
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
  glow: number; // opacity of the accent glows behind the scene (0 on paper)
  headline: HeadlineMark;
  chip: "circle" | "rounded";
};

type StageJson = Omit<Theme, "name" | "base" | "baseStops" | "family"> & {family: string; base: string[]};

const STAGES = TOKENS.stages as unknown as Record<ThemeName, StageJson>;

const build = (name: ThemeName): Theme => {
  const s = STAGES[name];
  const [a, b, c] = s.base;
  return {...s, name, family: s.family as Family, baseStops: s.base,
    base: `linear-gradient(180deg, ${a} 0%, ${b} 55%, ${c} 100%)`};
};

const THEMES = Object.fromEntries(
  (Object.keys(STAGES) as ThemeName[]).map((n) => [n, build(n)]),
) as Record<ThemeName, Theme>;

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export const themeFor = (name?: string | null): Theme =>
  (name && (THEMES as Record<string, Theme>)[name]) || THEMES.classic;

// Standalone renders (Studio sample, single scenes) default to the classic look.
export const ThemeContext = createContext<Theme>(THEMES.classic);
export const useTheme = () => useContext(ThemeContext);

/** Light text inside a phone panel in this theme's tint. */
export const muted = (t: Theme, alpha = TOKENS.brand.panelMutedAlpha) => `rgba(${t.ink},${alpha})`;

/** Corner radius of an icon chip of size `size` in this theme. */
export const chipRadius = (t: Theme, size: number) => (t.chip === "rounded" ? Math.round(size * 0.3) : size / 2);

/* ------------------------------------------------------------------ fixed brand layer */

export type Tone = {label: string; fill: string; ink: string; solid: string; onSolid: string; tint: string;
  marker: string};

export type CategoryName = "ai" | "security" | "smishing" | "voice";

export const TONES = TOKENS.tones as Record<"danger" | "caution" | "safe", Tone>;
export const CATEGORIES = TOKENS.categories as Record<CategoryName, Tone>;
export const NOTE = TOKENS.note;
export const CAPTION = TOKENS.caption;
export const TYPE = TOKENS.type;
export const BRAND = TOKENS.brand;

export const categoryFor = (name?: string | null): CategoryName =>
  name && name in CATEGORIES ? (name as CategoryName) : "security";

export const CategoryContext = createContext<CategoryName>("security");
export const useCategory = () => useContext(CategoryContext);

/** Scene accent -> tone: red/yellow/green are the semantic tones, blue is the episode's category colour. */
export const toneOf = (accent: Accent, category: CategoryName): Tone =>
  accent === "red" ? TONES.danger : accent === "yellow" ? TONES.caution : accent === "green" ? TONES.safe
    : CATEGORIES[category];

export const useTone = (accent: Accent): Tone => toneOf(accent, useCategory());
