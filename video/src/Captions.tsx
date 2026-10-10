import React from "react";
import {spring, useCurrentFrame, useVideoConfig} from "remotion";
import {SpeakerChip, useCast} from "./dialogue";
import {CAPTION} from "./themes";
import {CaptionPage} from "./types";

// Same on every stage (tokens.json "caption"; contrast checked by tests/test_design_tokens.py).
const HIGHLIGHT = CAPTION.highlight;

/** Text with a thick black outline: a stroked copy underneath, the fill on top (reliable in headless Chrome). */
const Outlined: React.FC<{text: string; color: string}> = ({text, color}) => (
  <span style={{position: "relative", display: "inline-block"}}>
    <span style={{position: "absolute", left: 0, top: 0, WebkitTextStroke: `${CAPTION.outlineWidth}px ${CAPTION.outline}`,
      color: CAPTION.outline}}>{text}</span>
    <span style={{position: "relative", color}}>{text}</span>
  </span>
);

/** Word-synced captions: the page of words being spoken, the current word in yellow and slightly larger; in a
 * dialogue scene the speaker's chip sits above the page. */
export const Captions: React.FC<{pages: CaptionPage[]; instantFirst?: boolean}> = ({pages, instantFirst}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cast = useCast();
  const t = (frame / fps) * 1000;
  // instantFirst: the opening caption is already on screen during a lead-in (e.g. the phone rings first), so frame 0
  // shows the hook sentence even when the voice starts a moment later
  const early = instantFirst && pages.length > 0 && t < pages[0].startMs ? pages[0] : undefined;
  const page = early ?? pages.find((p) => t >= p.startMs && t < p.endMs);
  if (!page) return null;
  const pageFrame = Math.round(((t - page.startMs) / 1000) * fps);
  // the very first page of the video is on screen from frame 0 (no pop-in), so the opening frame is complete
  // (it was already on screen during a lead-in, so it must not pop again when its own start time comes)
  const pop = instantFirst && page === pages[0] ? 1 : spring({frame: pageFrame, fps, config: {damping: 13, mass: 0.5}});
  // dialogue: the speaker chip pops in with the line's first page and stays while the line's pages turn
  const member = page.speaker ? cast[page.speaker] : undefined;
  const lineStart = pages.find((p) => p.line === page.line && p.speaker === page.speaker) ?? page;
  const chip = member ? (
    <SpeakerChip member={member} fromMs={lineStart.startMs} instant={instantFirst && lineStart === pages[0]} />
  ) : null;
  return (
    <>
    {chip}
    <div style={{position: "absolute", top: 1255, left: 70, right: 150, display: "flex", flexWrap: "wrap",
      justifyContent: "center", alignItems: "baseline", columnGap: 36, rowGap: 6, fontSize: 82, fontWeight: 800,
      lineHeight: 1.15, transform: `scale(${0.9 + 0.1 * pop})`, opacity: pop}}>
      {page.words.map((w, i) => {
        const next = page.words[i + 1];
        const active = t >= w.startMs && t < (next ? next.startMs : w.endMs + 120);
        return (
          <span key={i} style={{display: "inline-block", transform: `scale(${active ? 1.04 : 1})`,
            transformOrigin: "50% 70%"}}>
            <Outlined text={w.text} color={active ? HIGHLIGHT : CAPTION.fill} />
          </span>
        );
      })}
    </div>
    </>
  );
};
