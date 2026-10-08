import React from "react";
import {spring, useCurrentFrame, useVideoConfig} from "remotion";
import {CaptionPage} from "./types";

const HIGHLIGHT = "#FFD23F";

/** Text with a thick black outline: a stroked copy underneath, the fill on top (reliable in headless Chrome). */
const Outlined: React.FC<{text: string; color: string}> = ({text, color}) => (
  <span style={{position: "relative", display: "inline-block"}}>
    <span style={{position: "absolute", left: 0, top: 0, WebkitTextStroke: "12px #000", color: "#000"}}>{text}</span>
    <span style={{position: "relative", color}}>{text}</span>
  </span>
);

/** Word-synced captions: the page of words being spoken, the current word in yellow and slightly larger. */
export const Captions: React.FC<{pages: CaptionPage[]}> = ({pages}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = (frame / fps) * 1000;
  const page = pages.find((p) => t >= p.startMs && t < p.endMs);
  if (!page) return null;
  const pageFrame = Math.round(((t - page.startMs) / 1000) * fps);
  const pop = spring({frame: pageFrame, fps, config: {damping: 13, mass: 0.5}});
  return (
    <div style={{position: "absolute", top: 1255, left: 70, right: 150, display: "flex", flexWrap: "wrap",
      justifyContent: "center", alignItems: "baseline", columnGap: 36, rowGap: 6, fontSize: 82, fontWeight: 800,
      lineHeight: 1.15, transform: `scale(${0.9 + 0.1 * pop})`, opacity: pop}}>
      {page.words.map((w, i) => {
        const next = page.words[i + 1];
        const active = t >= w.startMs && t < (next ? next.startMs : w.endMs + 120);
        return (
          <span key={i} style={{display: "inline-block", transform: `scale(${active ? 1.04 : 1})`,
            transformOrigin: "50% 70%"}}>
            <Outlined text={w.text} color={active ? HIGHLIGHT : "#FFFFFF"} />
          </span>
        );
      })}
    </div>
  );
};
