// Dialogue (드라마형) helpers: who is speaking at a given moment, how loud (for the waveform and 도치's mouth), and the
// speaker chip over the captions. Everything is a pure function of the frame and the line spans Python measured
// from the audio (SceneProps.lines), so visuals stay in sync with the voices without any state between frames.
import React, {createContext, useContext} from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import COMP from "./composition.json";
import {spr, useScene} from "./motion";
import {SPEAKER_CHIPS} from "./themes";
import {CastMember, SceneProps, SpokenLine} from "./types";

export const CastContext = createContext<Record<string, CastMember>>({});
export const useCast = () => useContext(CastContext);

/** Speech time (ms from the scene's start, the audio's clock) at the current frame: the first scene's visuals run
 * POSTER frames ahead of its audio (poster start), so the scene's `shift` is taken off. */
export const useSpeechMs = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const shift = useScene().shift ?? 0;
  return ((frame - shift) / fps) * 1000;
};

/** Index of the line being spoken at `ms`, or -1 (between lines, before the first, after the last). */
export const activeLine = (lines: SpokenLine[] | undefined, ms: number) =>
  (lines ?? []).findIndex((l) => ms >= l.startMs && ms < l.endMs);

/** 0..1 loudness envelope of a line at `ms`: a 90 ms attack, a 140 ms release after its end. */
export const lineLevel = (line: SpokenLine, ms: number) =>
  Math.max(0, Math.min(1, (ms - line.startMs) / 90, (line.endMs + 140 - ms) / 140));

/** The loudest line of `side` ("me" / "them") or of `speakerRole` at `ms`: 0 when nobody on that side talks. */
export const sideLevel = (scene: SceneProps, side: "me" | "them", ms: number) =>
  (scene.lines ?? []).reduce((m, l) => (l.side === side ? Math.max(m, lineLevel(l, ms)) : m), 0);

/** How many lines of `side` have started by `ms` (e.g. 도치 bristles a little more at every scammer line). */
export const linesStarted = (scene: SceneProps, ms: number, pred: (l: SpokenLine) => boolean) =>
  (scene.lines ?? []).filter((l) => pred(l) && ms >= l.startMs).length;

/** A small speech waveform: `bars` rounded bars whose heights follow the level, wobbling deterministically. */
export const Waveform: React.FC<{level: number; color: string; height?: number; bars?: number; width?: number;
  seed?: number}> = ({level, color, height = 56, bars = 7, width = 10, seed = 0}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: "flex", alignItems: "center", gap: width * 0.8, height, opacity: 0.35 + 0.65 * level}}>
      {Array.from({length: bars}, (_, i) => {
        const mid = 1 - Math.abs(i - (bars - 1) / 2) / bars; // taller in the middle
        const wob = Math.abs(Math.sin(frame * 0.83 + i * 1.7 + seed) * Math.sin(frame * 0.31 + i * 0.9 + seed * 0.5));
        const h = Math.max(width, height * (0.16 + 0.84 * level * mid * (0.35 + 0.65 * wob)));
        return <div key={i} style={{width, height: h, borderRadius: width, background: color}} />;
      })}
    </div>
  );
};

/** Top of the speaker chip: just above the caption page (captions start at y 1255); its text size (composition.json
 * packaging.speakerChip, 2026-10-17: 44 px, so the name still reads at a 390 px phone width). */
export const SPEAKER_CHIP_TOP = COMP.packaging.speakerChip.top;
export const SPEAKER_CHIP_FONT = COMP.packaging.speakerChip.font;

/**
 * The speaker's name over the caption page ("사기범", "엄마", "도치"): a solid pill in the role's colour with a light ring
 * (reads on light and dark stages). It pops in when the speaker's line starts and stays through that line's pages.
 */
export const SpeakerChip: React.FC<{member: CastMember; fromMs: number; instant?: boolean}> = ({member, fromMs,
  instant}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!member.label) return null;
  const chip = SPEAKER_CHIPS[member.role] ?? SPEAKER_CHIPS.neutral;
  const s = instant ? 1 : spr(frame, (fromMs / 1000) * fps, 10, 0.04);
  // the inner voice (속마음) reads as a thought: the violet pill trails two small thought dots toward the left
  const thought = member.role === "inner";
  return (
    <div style={{position: "absolute", top: SPEAKER_CHIP_TOP, left: 70, right: 150, display: "flex",
      justifyContent: "center", pointerEvents: "none"}}>
      <div style={{position: "relative", padding: "6px 28px 7px", borderRadius: 999, background: chip.bg,
        color: chip.text, border: `4px solid ${chip.ring}`, fontSize: SPEAKER_CHIP_FONT, fontWeight: 800, lineHeight: 1.1,
        whiteSpace: "nowrap", boxShadow: "0 6px 16px rgba(0,0,0,0.32)", opacity: Math.min(1, s * 1.4),
        transform: `translateY(${(1 - s) * 14}px) scale(${0.8 + 0.2 * s})`}}>
        {member.label}
        {thought ? [[-28, 36, 12], [-52, 52, 8]].map(([x, y, r], k) => (
          <div key={k} style={{position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r,
            borderRadius: r, background: chip.bg, border: `3px solid ${chip.ring}`}} />
        )) : null}
      </div>
    </div>
  );
};
