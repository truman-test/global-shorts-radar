// The cold open (flash-forward, script "cold_open"; reports/직원회의_패키징.md 2-3): the video opens on the twist close-up
// a moment after its stamp landed (the loser's face, full colour, the stamp already on: frame 0 is the poster and the
// loop's tail), the exclamation plays from 0.0 s under a slow punch-in; then an 8-frame rewind wipes back to the
// story's opening: the frozen shot shrinks a little and streaks left under scanlines while the opening frame sweeps
// in from the right behind a bright tape edge. Motion only: the two pictures are built by Short.tsx (frozen scenes).
// Everything is a pure function of the frame (packaging.cold in composition.json).
import React from "react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import {hash01, PACK, SPEC} from "./rig";
import {ColdOpen} from "./types";

export const COLD = PACK.cold;

/** The cold open's frames: the frozen hold (the exclamation + a pad) and the whole, with the rewind. */
export const coldFrames = (cold: ColdOpen, fps: number) => {
  const hold = Math.max(1, Math.round((cold.holdMs / 1000) * fps));
  return {hold, total: hold + COLD.rewind};
};

const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const easeInOut = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

/** Where the punch-in centres: the twist close-up's face. */
const FACE = SPEC.twist_closeup.shots.twist.chars[0];

/**
 * `shot` = the twist scene frozen with its stamp, `story` = the story's opening frame (frozen). `hold` frames of the
 * frozen shot (1.00 -> packaging.cold.punch, ease-out: moving within 0.3 s, unzoomed at frame 0), then the rewind.
 */
export const ColdOpenFrames: React.FC<{shot: React.ReactNode; story: React.ReactNode; hold: number}> = ({shot,
  story, hold}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const origin = `${FACE.x}px ${FACE.eyeY}px`;
  if (f < hold) {
    const zoom = 1 + (COLD.punch - 1) * easeOut(f / Math.max(hold, 0.6 * fps));
    return (
      <div style={{position: "absolute", inset: 0, overflow: "hidden"}}>
        <div style={{position: "absolute", inset: 0, transform: zoom === 1 ? undefined : `scale(${zoom})`,
          transformOrigin: origin}}>{shot}</div>
      </div>
    );
  }
  const zoom0 = 1 + (COLD.punch - 1) * easeOut(hold / Math.max(hold, 0.6 * fps));
  const r = (f - hold + 1) / COLD.rewind;   // 1/8 .. 1: the last frame before the story is almost all story
  const e = easeInOut(r);
  const streak = Math.sin(Math.PI * Math.min(1, r * 1.15));
  const edge = 1080 * (1 - e);              // the wipe's edge travels right -> left
  const lines = 0.5 * Math.sin(Math.PI * r);
  // two tracking bands at seeded heights per frame (a tape picture jumping back)
  const bands = [0, 1].map((k) => ({y: 260 + hash01(f, k) * 1300, h: 14 + 30 * hash01(f, k + 7)}));
  return (
    <div style={{position: "absolute", inset: 0, overflow: "hidden", background: "#0B0D12"}}>
      <svg width={0} height={0} style={{position: "absolute"}}>
        <filter id="coldRewindBlur" x="-10%" y="0%" width="120%" height="100%">
          <feGaussianBlur stdDeviation={`${(28 * streak).toFixed(2)} 0`} />
        </filter>
      </svg>
      <div style={{position: "absolute", inset: 0, transformOrigin: origin, filter: streak > 0.02 ? "url(#coldRewindBlur)" : undefined,
        transform: `translateX(${-110 * e}px) scale(${zoom0 - COLD.shrink * e})`, opacity: 1 - 0.35 * e}}>
        {shot}
      </div>
      <div style={{position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${edge}px)`}}>{story}</div>
      {/* the tape edge */}
      <div style={{position: "absolute", top: 0, bottom: 0, left: edge - 18, width: 36, opacity: r < 1 ? 0.9 : 0,
        background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(240,246,255,0.95) 45%, rgba(255,255,255,0.95) 55%, rgba(255,255,255,0) 100%)",
        boxShadow: "0 0 40px rgba(200,225,255,0.7)"}} />
      {/* scanlines over the whole picture */}
      <div style={{position: "absolute", inset: 0, opacity: lines,
        background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)"}} />
      {bands.map((b, k) => (
        <div key={k} style={{position: "absolute", left: 0, right: 0, top: b.y, height: b.h, opacity: 0.55 * streak,
          background: "linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.75), rgba(255,255,255,0.15))"}} />
      ))}
    </div>
  );
};
