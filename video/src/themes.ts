// Visual themes: each video gets its own background pattern, base colours, accent palette, surface colours,
// headline treatment and icon-chip shape, so consecutive Shorts never look like one template. The brand stays
// fixed across themes: channel name + "AI 음성" badge, Pretendard, the caption style, the disclaimer badge,
// the layouts and the continuity transition.
//
// Names match radar.production.themes.THEMES (Python picks one per script and passes it as the `theme` prop).
import {createContext, useContext} from "react";
import {Accent, ACCENTS} from "./types";

export type ThemeName = "classic" | "pulse" | "circuit" | "scan" | "aurora" | "contour" | "notebook" | "dots";

/** Background pattern drawn by Backdrop.tsx. */
export type Pattern = "grid" | "rings" | "traces" | "diagonal" | "ribbons" | "topo" | "ruled" | "matrix";

/** How the headline is set off: accent rule under it, highlighter band behind it, or corner brackets around it. */
export type HeadlineMark = "rule" | "marker" | "brackets";

export type Theme = {
  name: ThemeName;
  pattern: Pattern;
  base: string; // CSS background of the whole frame
  accents: Record<Accent, string>; // the scene accent colours, tuned to stay readable on this base
  ink: string; // "r,g,b" of muted text (used with alpha)
  panel: string; // phone panels, checklist card
  bubble: string; // incoming message bubble
  bubbleMe: string; // outgoing message bubble (neutral, never a real messenger's colour)
  avatar: [string, string]; // avatar gradient
  railOff: string; // timeline dot before it is reached
  wallpaper: [string, string, string]; // alert lock screen: gradient + two soft blobs
  glow: number; // opacity of the accent glows behind the scene (classic 0.22)
  headline: HeadlineMark;
  chip: "circle" | "rounded";
};

const THEMES: Record<ThemeName, Theme> = {
  // the original look (navy, drifting square grid); kept for re-renders of published videos, not rotated
  classic: {
    name: "classic", pattern: "grid",
    base: "linear-gradient(180deg, #060b16 0%, #0b1730 55%, #0e1d3a 100%)",
    accents: ACCENTS,
    ink: "214,224,240", panel: "rgba(14,21,38,0.94)", bubble: "#26324D", bubbleMe: "#5B63F0",
    avatar: ["#2b3d63", "#18233c"], railOff: "#1b2640",
    wallpaper: ["linear-gradient(160deg, #23315a 0%, #3b2d63 45%, #142240 100%)", "#5a7dff", "#c45cff"],
    glow: 0.22, headline: "rule", chip: "circle",
  },
  // dark teal, concentric rings slowly expanding from behind the content, a faint sweep: voice and call scams
  pulse: {
    name: "pulse", pattern: "rings",
    base: "linear-gradient(180deg, #021113 0%, #04212a 55%, #062b35 100%)",
    accents: {red: "#FF6B6B", yellow: "#FFD54A", green: "#43E8B2", blue: "#52D2FF"},
    ink: "204,234,236", panel: "rgba(5,27,33,0.95)", bubble: "#1b3d45", bubbleMe: "#4a62e8",
    avatar: ["#1f5560", "#0f2d33"], railOff: "#11323a",
    wallpaper: ["linear-gradient(160deg, #0f4048 0%, #183a5e 50%, #072229 100%)", "#2fc3c9", "#3d6fe0"],
    glow: 0.2, headline: "rule", chip: "circle",
  },
  // neutral charcoal, faint circuit traces with a few signals running along them: hacking, malware, data leaks
  circuit: {
    name: "circuit", pattern: "traces",
    base: "linear-gradient(180deg, #08090b 0%, #0e1114 55%, #13171b 100%)",
    accents: {red: "#FF5964", yellow: "#F7D84B", green: "#3BE68F", blue: "#45BBFF"},
    ink: "218,224,230", panel: "rgba(19,22,26,0.96)", bubble: "#2a3038", bubbleMe: "#4f5bd5",
    avatar: ["#3a424d", "#1d2229"], railOff: "#23282f",
    wallpaper: ["linear-gradient(160deg, #1d242c 0%, #2a3340 45%, #101418 100%)", "#3a8fff", "#30d39a"],
    glow: 0.16, headline: "brackets", chip: "rounded",
  },
  // indigo ink, fine diagonal hatching sliding slowly and a soft scan band: phishing texts, links, fake numbers
  scan: {
    name: "scan", pattern: "diagonal",
    base: "linear-gradient(180deg, #070923 0%, #0c1140 55%, #11174f 100%)",
    accents: {red: "#FF5C70", yellow: "#FFD84D", green: "#46E0A2", blue: "#7DB9FF"},
    ink: "216,220,248", panel: "rgba(12,15,50,0.95)", bubble: "#262d68", bubbleMe: "#5d68ff",
    avatar: ["#343e8a", "#1a1f4d"], railOff: "#1d2358",
    wallpaper: ["linear-gradient(160deg, #1f2a78 0%, #3a2c7a 45%, #10164a 100%)", "#5f7bff", "#a35cff"],
    glow: 0.2, headline: "marker", chip: "rounded",
  },
  // dark plum, slow aurora ribbons and silk lines: AI images, deepfakes, synthetic video
  aurora: {
    name: "aurora", pattern: "ribbons",
    base: "linear-gradient(180deg, #0c0612 0%, #170b22 55%, #1f0f2d 100%)",
    accents: {red: "#FF5F87", yellow: "#FFD166", green: "#4CE3A9", blue: "#86A9FF"},
    ink: "232,220,242", panel: "rgba(25,12,35,0.95)", bubble: "#3a2450", bubbleMe: "#6a5cf5",
    avatar: ["#4d2f68", "#26163a"], railOff: "#2d1a3d",
    wallpaper: ["linear-gradient(160deg, #3a1d5c 0%, #5a2a6e 45%, #1c0f33 100%)", "#b45cff", "#ff6fae"],
    glow: 0.16, headline: "brackets", chip: "circle",
  },
  // deep forest ink, topographic contour lines drifting slowly (a market chart's terrain): investment, money
  contour: {
    name: "contour", pattern: "topo",
    base: "linear-gradient(180deg, #050e0b 0%, #091a15 55%, #0c221c 100%)",
    accents: {red: "#FF6B5E", yellow: "#F4C84E", green: "#5DE592", blue: "#5BB6F2"},
    ink: "212,232,222", panel: "rgba(8,25,20,0.95)", bubble: "#1f3a33", bubbleMe: "#4a68e0",
    avatar: ["#2a5246", "#13291f"], railOff: "#143029",
    wallpaper: ["linear-gradient(160deg, #134236 0%, #2b4a2f 45%, #0a231d 100%)", "#3fd39a", "#e0b84a"],
    glow: 0.18, headline: "rule", chip: "rounded",
  },
  // warm near-black, faint ruled notebook lines and paper grain (the channel is a "notebook"): kids, family
  notebook: {
    name: "notebook", pattern: "ruled",
    base: "linear-gradient(180deg, #110c08 0%, #1b140e 55%, #231a12 100%)",
    accents: {red: "#FF6A55", yellow: "#FFC94A", green: "#72DB9C", blue: "#6CB8F6"},
    ink: "240,228,212", panel: "rgba(32,24,18,0.96)", bubble: "#3b2e24", bubbleMe: "#5a64e6",
    avatar: ["#5a4434", "#2c2119"], railOff: "#33271e",
    wallpaper: ["linear-gradient(160deg, #4a3220 0%, #5a3a3a 45%, #22170f 100%)", "#ffb35c", "#ff7a6b"],
    glow: 0.2, headline: "marker", chip: "rounded",
  },
  // wine graphite, a fine dot matrix that a slow diagonal light wave passes over: general rotation
  dots: {
    name: "dots", pattern: "matrix",
    base: "linear-gradient(180deg, #0f080d 0%, #190e16 55%, #21121d 100%)",
    accents: {red: "#FF6470", yellow: "#FFD25A", green: "#50E0A2", blue: "#76B6FF"},
    ink: "236,222,232", panel: "rgba(30,17,27,0.95)", bubble: "#3a2635", bubbleMe: "#5c62ea",
    avatar: ["#58354d", "#2a1825"], railOff: "#33202e",
    wallpaper: ["linear-gradient(160deg, #4a2240 0%, #3a2a5e 45%, #1e0f1b 100%)", "#ff6fa0", "#7a6cff"],
    glow: 0.18, headline: "marker", chip: "circle",
  },
};

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export const themeFor = (name?: string | null): Theme =>
  (name && (THEMES as Record<string, Theme>)[name]) || THEMES.classic;

// Standalone renders (Studio sample, single scenes) default to the classic look.
export const ThemeContext = createContext<Theme>(THEMES.classic);
export const useTheme = () => useContext(ThemeContext);

/** Muted text in this theme's tint. */
export const muted = (t: Theme, alpha = 0.72) => `rgba(${t.ink},${alpha})`;

/** Corner radius of an icon chip of size `size` in this theme. */
export const chipRadius = (t: Theme, size: number) => (t.chip === "rounded" ? Math.round(size * 0.3) : size / 2);
