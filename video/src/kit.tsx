import React, {useLayoutEffect, useRef} from "react";
import {interpolate, useCurrentFrame} from "remotion";
import {handBox, handLine, markerStyle, seedOf} from "./hand";
import {Anchor, Face, fade, fadeOut, IN_AT, IN_DUR, spr, useMorphIn, useScene} from "./motion";
import {BRAND, muted, NOTE, Theme, Tone, TYPE, useTheme, useTone} from "./themes";
import {SceneProps} from "./types";

export const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;

// Vertical zones (px) shared by the layouts. The top bar/disclaimer sit above HEADER_TOP,
// captions start at 1255, and the bottom 20% + right rail belong to YouTube's own buttons.
export const HEADER_TOP = 246;
export const HEADER_H = 256;
export const BODY_TOP = 530;
export const BODY_BOTTOM = 1200;

/** Light text inside phone panels (all panels are dark on every stage). */
export const TEXT = BRAND.panelText;

export const CHIP = 98; // header icon chip (outer size), the shared element of the mockup layouts

/** Horizontal extent of the body (panels, cards) under the header: full width, or narrowed so 도치 has the margin. */
export const BODY = {left: 110, width: 860};
export const ROOM = {left: 206, width: 766}; // 도치 stands in x ~16-196; right edge stays at 972
export const bodyBox = (mascot?: boolean) => (mascot ? ROOM : BODY);
export const useBody = () => bodyBox(useScene().mascot);

export type ShellStyle = "slide" | "swipe" | "fade";

/**
 * Enter/exit of a whole scene. Classic: each layout's own slide/swipe/fade in, fade out over the last
 * 7 frames. Continuity: no movement, the content only crossfades around the boundary while the shared
 * element (icon chip / avatar) travels between scenes (see Traveller in Short.tsx).
 */
export const useShell = (style: ShellStyle): React.CSSProperties => {
  const frame = useCurrentFrame();
  const s = useScene();
  const cont = s.mode === "continuity";
  const classicExit = interpolate(frame, [s.frames - 7, s.frames], [1, 0], clamp);
  const exit = cont && !s.last ? fadeOut(frame, s.frames) : classicExit;
  if (cont && !s.first) return {opacity: exit * fade(frame, IN_AT, IN_DUR)};
  if (style === "swipe") {
    const e = spr(frame, 0, 14, 0.01);
    return {opacity: exit, transform: `translateX(${(1 - e) * 120}px) scale(${0.97 + 0.03 * e})`};
  }
  if (style === "fade") return {opacity: exit * Math.min(1, spr(frame, 0, 16))};
  const e = spr(frame, 0, 16, 0);
  return {opacity: exit * Math.min(1, e * 1.4), transform: `translateY(${(1 - e) * 60}px)`};
};

export const SceneShell: React.FC<{children: React.ReactNode; style?: ShellStyle}> = ({children, style = "slide"}) => (
  <div style={{position: "absolute", inset: 0, ...useShell(style)}}>{children}</div>
);

/* ------------------------------------------------------------------ the note card (fixed brand element) */

// Faint paper fibres inside the card (multiplied, so it only ever darkens the white a touch).
const CARD_GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>"
  + "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='11' stitchTiles='stitch'/>"
  + "<feColorMatrix values='0 0 0 0 0.45  0 0 0 0 0.40  0 0 0 0 0.32  0 0 0 -1.1 0.62'/></filter>"
  + "<rect width='220' height='220' filter='url(#n)'/></svg>");

/**
 * Paper stage, scene change: a wobbly ink line runs in from the page margin and draws the card's outline
 * (strokeDashoffset), then fades as the card itself fades in, so the next card looks drawn rather than cut in.
 * The card is measured on screen (its height depends on the text), the path set directly on the element.
 */
const SketchOutline: React.FC<{seed: number}> = ({seed}) => {
  const frame = useCurrentFrame();
  const box = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const p = interpolate(frame, [0, 12], [0, 1], {...clamp, easing: (x) => 1 - (1 - x) ** 2});
  const op = interpolate(frame, [10, 18], [1, 0], clamp);
  useLayoutEffect(() => {
    const el = box.current?.parentElement as HTMLElement | null;
    if (!el || !path.current) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const lead = handLine(40 - el.offsetLeft, -7, 10, -7, seed, 3);
    const outline = handBox(-7, -7, w + 14, h + 14, NOTE.radius + 6, seed + 1);
    const total = lead.len + outline.len;
    path.current.setAttribute("d", `${lead.d} ${outline.d.replace(/^M/, "L")}`);
    path.current.setAttribute("stroke-dasharray", `${total} ${total + 4}`);
    path.current.setAttribute("stroke-dashoffset", `${total * (1 - p)}`);
  });
  if (op <= 0) return null;
  return (
    <div ref={box} style={{position: "absolute", inset: 0, pointerEvents: "none", opacity: op}}>
      <svg style={{position: "absolute", left: 0, top: 0, overflow: "visible"}} width={1} height={1}>
        <path ref={path} fill="none" stroke={NOTE.ink} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round"
          opacity={p > 0 ? 0.85 : 0} />
      </svg>
    </div>
  );
};

/**
 * The white note card every key text sits on, on every stage: same radius, same soft shadow, the folded top-right
 * corner and faint paper grain. Absolutely positioned by `box`; children are laid out inside the padding. On paper
 * stages a card that arrives with a scene change is sketched in ink first (SketchOutline).
 */
export const NoteCard: React.FC<{box: React.CSSProperties; fold?: number; pad?: number | string;
  children?: React.ReactNode; inner?: React.CSSProperties}> = ({box, fold = 58, pad = 0, children, inner}) => {
  const t = useTheme();
  const s = useScene();
  const sketch = t.family === "paper" && s.mode === "continuity" && !s.first;
  return (
    <div style={{position: "absolute", filter: "drop-shadow(0 16px 26px rgba(10,14,25,0.22)) drop-shadow(0 2px 3px rgba(10,14,25,0.12))",
      ...box}}>
      <div style={{position: "relative", width: "100%", height: "100%", boxSizing: "border-box", padding: pad,
        background: NOTE.paper, color: NOTE.ink, borderRadius: NOTE.radius,
        clipPath: `polygon(0 0, calc(100% - ${fold}px) 0, 100% ${fold}px, 100% 100%, 0 100%)`, ...inner}}>
        <div style={{position: "absolute", inset: 0, borderRadius: NOTE.radius, backgroundImage: `url("${CARD_GRAIN}")`,
          backgroundSize: "220px 220px", mixBlendMode: "multiply", opacity: 0.5, pointerEvents: "none"}} />
        {/* the folded corner: the flap lies over the card, a shade darker, with a soft crease shadow */}
        <div style={{position: "absolute", top: 0, right: 0, width: fold, height: fold, borderBottomLeftRadius: 10,
          background: `linear-gradient(45deg, ${NOTE.fold} 50%, transparent 50%)`,
          boxShadow: "-3px 3px 6px rgba(10,14,25,0.10)"}} />
        <div style={{position: "relative", width: "100%", height: "100%"}}>{children}</div>
      </div>
      {sketch ? <SketchOutline seed={s.index * 97 + 13} /> : null}
    </div>
  );
};
/* ------------------------------------------------------------------ headlines with a marked key phrase */

/**
 * Indices of the headline words to mark: the scene's own `mark` (a substring of the headline) if given;
 * otherwise the part after a comma, else the words with a number, else the last word (last two of 4+ words).
 */
export const markedWords = (headline: string, mark?: string): Set<number> => {
  const words = headline.split(" ");
  const out = new Set<number>();
  if (mark && headline.includes(mark)) {
    const start = headline.indexOf(mark);
    let pos = 0;
    words.forEach((w, i) => {
      const a = pos;
      const b = pos + w.length;
      if (b > start && a < start + mark.length) out.add(i);
      pos = b + 1;
    });
    return out;
  }
  const comma = words.findIndex((w) => w.endsWith(","));
  if (comma >= 0 && comma < words.length - 1) {
    for (let i = comma + 1; i < words.length; i++) out.add(i);
    return out;
  }
  // numbers carry the point ("670만 원"): the words with a digit, plus a short unit word right after one
  words.forEach((w, i) => {
    if (/\d/.test(w)) {
      out.add(i);
      if (i + 1 < words.length && words[i + 1].length <= 2 && !/\d/.test(words[i + 1])) out.add(i + 1);
    }
  });
  if (out.size) return out;
  out.add(words.length - 1);
  if (words.length >= 4) out.add(words.length - 2);
  return out;
};

const Underline: React.FC<{p: number; color: string; seed: number}> = ({p, color, seed}) => {
  const s = handLine(6, 12, 994, 8, seed, 6);
  return (
    <svg viewBox="0 0 1000 24" preserveAspectRatio="none" style={{position: "absolute", left: -6, bottom: "-0.14em",
      width: "calc(100% + 12px)", height: "0.22em", overflow: "visible", pointerEvents: "none"}}>
      <path d={s.d} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - Math.min(1, Math.max(0, p))}
        fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" opacity={p > 0 ? 1 : 0} />
    </svg>
  );
};

/** Frame (scene-local) by which a headline started at `start` with `step` has its key phrase fully marked. */
export const headlineDone = (text: string, start: number, step: number) => start + text.split(" ").length * step + 14;

/**
 * Headline words popping in one by one on the note card (dark ink); the key phrase gets the stage's mark
 * (highlighter band, or a hand-drawn underline under each of its words) in the scene's tone once its words have
 * landed. The marked phrase stays inline, so balanced line breaks can still split it.
 */
export const Headline: React.FC<{text: string; mark?: string; size: number; tone: Tone; theme: Theme;
  start: number; step: number; rise?: number; align?: "center" | "left"}> = ({
  text, mark, size, tone, theme, start, step, rise = 28, align = "center",
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const marked = markedWords(text, mark);
  const keys = [...marked];
  const markAt = start + (keys.length ? Math.max(...keys) : 0) * step + 5;
  const p = spr(frame, markAt, 10, 0);
  const seed = seedOf(text);
  const underline = theme.headline === "underline";
  const word = (w: string, i: number) => {
    const s = spr(frame, start + i * step, 12, 0.03);
    return (
      <span key={i} style={{position: "relative", display: "inline-block", opacity: Math.min(1, s),
        transform: `translateY(${(1 - s) * rise}px)`}}>
        {w}
        {underline && marked.has(i) ? <Underline p={p} color={tone.fill} seed={seed + i} /> : null}
      </span>
    );
  };
  // consecutive marked words share one highlighter band (an inline span, cloned across line breaks)
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < words.length) {
    if (!marked.has(i) || underline) {
      parts.push(word(words[i], i));
      i++;
      continue;
    }
    const group: React.ReactNode[] = [];
    const first = i;
    while (i < words.length && marked.has(i)) {
      if (group.length) group.push(" ");
      group.push(word(words[i], i));
      i++;
    }
    parts.push(<span key={`m${first}`} style={markerStyle(tone.marker, p)}>{group}</span>);
  }
  return (
    <div style={{fontSize: size, fontWeight: TYPE.weights.display, lineHeight: 1.22, letterSpacing: -size * 0.018,
      wordSpacing: size * 0.06, color: NOTE.ink, textAlign: align,
      textWrap: "balance" as React.CSSProperties["textWrap"]}}>
      {parts.flatMap((part, k) => (k ? [" ", part] : [part]))}
    </div>
  );
};
/** Header font size by headline length (stays within two lines on the header card). */
export const headerSize = (headline: string) => {
  const n = headline.replace(/\s/g, "").length;
  const [a, b, c, d] = TYPE.header;
  return n <= 12 ? a : n <= 16 ? b : n <= 21 ? c : d;
};

/** Header note card: icon chip + headline (key phrase marked) + the sub-line under it. */
export const SceneHeader: React.FC<{scene: SceneProps; top?: number; height?: number}> = ({
  scene, top = HEADER_TOP, height = HEADER_H,
}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const tone = useTone(scene.accent);
  const morph = useMorphIn();
  const words = scene.headline.split(" ");
  const size = headerSize(scene.headline);
  // the chip arrives with the traveller when the scene morphs in; otherwise it pops in itself
  const iconIn = morph ? 1 : spr(frame, 1, 12, 0.04);
  // when the chip flies in, the words wait until it has nearly landed so they never appear under it
  const w0 = morph ? 8 : 3;
  const subIn = interpolate(frame, [w0 + 5 + words.length * 2, w0 + 15 + words.length * 2], [0, 1], clamp);
  return (
    <NoteCard box={{top, height, left: 56, right: 56}} fold={46}>
      <div style={{position: "absolute", inset: "0 44px 0 34px", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 14}}>
        <div style={{display: "flex", alignItems: "center", gap: 26, maxWidth: 860}}>
          <div style={{position: "relative", flex: "0 0 auto", opacity: Math.min(1, iconIn),
            transform: `scale(${0.4 + 0.6 * iconIn})`}}>
            <Anchor size={CHIP}>
              <Face look={{kind: "chip", icon: scene.icon, accent: scene.accent}} size={CHIP} />
            </Anchor>
          </div>
          <Headline text={scene.headline} mark={scene.mark} size={size} tone={tone} theme={t} start={w0} step={2}
            align="left" />
        </div>
        {scene.sub ? (
          <div style={{fontSize: 34, fontWeight: TYPE.weights.text, color: NOTE.muted, textAlign: "center",
            opacity: subIn, transform: `translateY(${(1 - subIn) * 10}px)`, maxWidth: 860, lineHeight: 1.2}}>
            {scene.sub}
          </div>
        ) : null}
      </div>
    </NoteCard>
  );
};

/** Rounded "screen" panel used by the chat, SMS and settings mockups: invented header, no real app's look. */
export const PhonePanel: React.FC<{header: React.ReactNode; children: React.ReactNode; top?: number;
  bottom?: number}> = ({header, children, top = BODY_TOP, bottom = BODY_BOTTOM}) => {
  const t = useTheme();
  const body = useBody();
  return (
    <div style={{position: "absolute", top, left: body.left, width: body.width, height: bottom - top, borderRadius: 48,
      background: t.panel, border: "2px solid rgba(255,255,255,0.12)", boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
      overflow: "hidden", display: "flex", flexDirection: "column", color: TEXT}}>
      <div style={{flex: "0 0 auto", height: 112, display: "flex", alignItems: "center", gap: 22, padding: "0 30px",
        borderBottom: "2px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)"}}>
        <div style={{fontSize: 56, fontWeight: 700, color: muted(t), marginTop: -8}}>‹</div>
        {header}
      </div>
      {children}
    </div>
  );
};

export const Avatar: React.FC<{label: string; size?: number; color?: string; children?: React.ReactNode}> = ({
  label, size = 68, color, children,
}) => {
  const t = useTheme();
  return (
    <div style={{flex: "0 0 auto", width: size, height: size, borderRadius: "50%",
      background: color ?? `linear-gradient(160deg, ${t.avatar[0]}, ${t.avatar[1]})`,
      border: "2px solid rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.46, fontWeight: 900, color: TEXT}}>
      {children ?? label.slice(0, 1)}
    </div>
  );
};

/** Spring progress that starts at `at` (0 before it): the shared spring with a scene-local frame. */
export const useAppear = (at: number, dur = 14, overshoot = 0.02) => spr(useCurrentFrame(), at, dur, overshoot);

/** Solid label pill (white text on the tone's dark solid: >= 7:1, see tests/test_design_tokens.py). */
export const TonePill: React.FC<{tone: Tone; children: React.ReactNode; size?: number; style?: React.CSSProperties}> = ({
  tone, children, size = 34, style,
}) => (
  <div style={{display: "inline-flex", alignItems: "center", gap: 10, padding: `${size * 0.22}px ${size * 0.62}px`,
    borderRadius: 999, background: tone.solid, color: tone.onSolid, fontSize: size, fontWeight: 900, lineHeight: 1.1,
    whiteSpace: "nowrap", ...style}}>
    {children}
  </div>
);
