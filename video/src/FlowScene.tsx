import React from "react";
import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {drawn, handBox, handLine, seedOf, Stroke} from "./hand";
import {BODY_BOTTOM, BODY_TOP, clamp, NoteCard, SceneHeader, SceneShell} from "./kit";
import {flowBeats} from "./schedule";
import {CATEGORIES, NOTE, Tone, useCategory, useTone} from "./themes";
import {FlowNode, SceneProps} from "./types";

const CARD = {top: BODY_TOP + 6, left: 110, width: 860};
const CARD_H = BODY_BOTTOM - 6 - CARD.top;
const MAIN = {x: 40, w: 470};
const SIDE = {x: 590, w: 230};
const PAD_Y = 36;

/** Characters per line at font size f inside a box of width w (Hangul ~0.98em, with 36 px padding). */
const perLine = (w: number, f: number) => Math.max(1, Math.floor((w - 36) / (f * 0.98)));
const linesOf = (text: string, w: number, f: number) => Math.ceil(text.replace(/\s/g, "").length / perLine(w, f));

type Placed = {node: FlowNode; y: number; h: number; side?: {text: string; label: string; y: number; h: number}};

/** Node boxes laid out top to bottom with even gaps; the font shrinks if five two-line nodes would not fit. */
const layout = (nodes: FlowNode[]): {placed: Placed[]; font: number} => {
  const avail = CARD_H - PAD_Y * 2;
  for (const font of [40, 37, 34, 31]) {
    const boxH = (text: string, w: number) => 34 + linesOf(text, w, font) * font * 1.25;
    const hs = nodes.map((n) => Math.max(boxH(n.text, MAIN.w), n.yes || n.no ? boxH(n.yes || n.no || "", SIDE.w) : 0));
    const total = hs.reduce((a, b) => a + b, 0);
    const gap = nodes.length > 1 ? (avail - total) / (nodes.length - 1) : 0;
    if (gap < 46 && font > 31) continue;
    const g = Math.min(90, Math.max(30, gap));
    const used = total + g * (nodes.length - 1);
    let y = PAD_Y + Math.max(0, (avail - used) / 2);
    const placed = nodes.map((node, k) => {
      const h = hs[k];
      const branch = node.yes || node.no;
      const p: Placed = {node, y, h};
      if (branch) {
        const sh = boxH(branch, SIDE.w);
        p.side = {text: branch, label: node.yes ? "예" : "아니오", y: y + (h - sh) / 2, h: sh};
      }
      y += h + g;
      return p;
    });
    return {placed, font};
  }
  return {placed: [], font: 31};
};

/** Arrow: a hand-drawn shaft and a two-stroke head, drawn in with p. */
const Arrow: React.FC<{x1: number; y1: number; x2: number; y2: number; p: number; color: string; seed: number}> = ({
  x1, y1, x2, y2, p, color, seed,
}) => {
  const shaft = handLine(x1, y1, x2, y2, seed, 2.5);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = (s: number): Stroke => handLine(x2, y2, x2 - Math.cos(ang + s * 0.5) * 22, y2 - Math.sin(ang + s * 0.5) * 22,
    seed + (s > 0 ? 3 : 4), 1);
  const ph = interpolate(p, [0.75, 1], [0, 1], clamp);
  return (
    <>
      <path {...drawn(shaft, p / 0.8)} stroke={color} strokeWidth={6} />
      <path {...drawn(head(1), ph)} stroke={color} strokeWidth={6} />
      <path {...drawn(head(-1), ph)} stroke={color} strokeWidth={6} />
    </>
  );
};

/**
 * Hand-drawn decision chart on the note card: 3-5 nodes drawn top to bottom as they are narrated (box first,
 * then its text), arrows between them; a node with a yes/no branch sends a labelled arrow to a side box and the
 * chain continues down with the other answer. The last node is the conclusion, highlighted in the scene tone.
 */
export const FlowScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tone = useTone(scene.accent);
  const cat: Tone = CATEGORIES[useCategory()];
  const nodes = scene.nodes ?? [];
  const beats = flowBeats(scene, fps);
  const {placed, font} = layout(nodes);
  const seed = seedOf(scene.headline);
  const pr = (at: number, dur: number) => interpolate(frame, [at, at + dur], [0, 1], clamp);

  return (
    <SceneShell>
      <SceneHeader scene={scene} />
      <NoteCard box={{...CARD, height: CARD_H}} fold={50}>
        <svg width={CARD.width} height={CARD_H} style={{position: "absolute", inset: 0, overflow: "visible"}}>
          {placed.map((pl, k) => {
            const at = beats[k];
            const last = k === placed.length - 1;
            const box = handBox(MAIN.x, pl.y, MAIN.w, pl.h, 22, seed + k * 17);
            const color = last ? tone.ink : NOTE.ink;
            const out: React.ReactNode[] = [];
            if (last) {
              // highlighter wash behind the conclusion, swept in after its box is drawn
              const hw = pr(at + 6, 10);
              out.push(<rect key={`h${k}`} x={MAIN.x + 8} y={pl.y + 8} width={(MAIN.w - 16) * hw} height={pl.h - 16} rx={16}
                fill={tone.marker} opacity={0.75} />);
            }
            out.push(<path key={`b${k}`} {...drawn(box, pr(at, 12))} stroke={color} strokeWidth={last ? 7 : 5} />);
            if (k > 0) {
              const prev = placed[k - 1];
              out.push(<Arrow key={`a${k}`} x1={MAIN.x + MAIN.w / 2} y1={prev.y + prev.h + 8} x2={MAIN.x + MAIN.w / 2}
                y2={pl.y - 10} p={pr(at - 8, 8)} color={NOTE.faint} seed={seed + k * 31} />);
              const prevSide = prev.side;
              if (prevSide) {
                const other = prevSide.label === "예" ? "아니오" : "예";
                out.push(<text key={`l${k}`} x={MAIN.x + MAIN.w / 2 + 18} y={(prev.y + prev.h + pl.y) / 2 + 12}
                  fontSize={30} fontWeight={800} fill={NOTE.muted} opacity={pr(at - 4, 6)}>{other}</text>);
              }
            }
            if (pl.side) {
              const s = pl.side;
              const sAt = at + 10;
              const sideBox = handBox(SIDE.x, s.y, SIDE.w, s.h, 20, seed + k * 23);
              const ay = pl.y + pl.h / 2;
              out.push(<Arrow key={`sa${k}`} x1={MAIN.x + MAIN.w + 8} y1={ay} x2={SIDE.x - 10} y2={ay} p={pr(sAt, 8)}
                color={cat.fill} seed={seed + k * 41} />);
              out.push(<text key={`sl${k}`} x={(MAIN.x + MAIN.w + SIDE.x) / 2} y={ay - 16} textAnchor="middle" fontSize={28}
                fontWeight={800} fill={cat.ink} opacity={pr(sAt + 2, 6)}>{s.label}</text>);
              out.push(<path key={`sb${k}`} {...drawn(sideBox, pr(sAt + 6, 10))} stroke={cat.fill} strokeWidth={5} />);
            }
            return <g key={k}>{out}</g>;
          })}
        </svg>
        {placed.map((pl, k) => {
          const at = beats[k];
          const last = k === placed.length - 1;
          const textIn = pr(at + 6, 8);
          return (
            <React.Fragment key={k}>
              <div style={{position: "absolute", left: MAIN.x, top: pl.y, width: MAIN.w, height: pl.h, display: "flex",
                alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 18px",
                boxSizing: "border-box", fontSize: font, fontWeight: last ? 900 : 800, lineHeight: 1.25,
                color: last ? tone.ink : NOTE.ink, opacity: textIn, transform: `translateY(${(1 - textIn) * 8}px)`}}>
                {pl.node.text}
              </div>
              {pl.side ? (
                <div style={{position: "absolute", left: SIDE.x, top: pl.side.y, width: SIDE.w, height: pl.side.h,
                  display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 18px",
                  boxSizing: "border-box", fontSize: font, fontWeight: 800, lineHeight: 1.25, color: cat.ink,
                  opacity: pr(at + 18, 8)}}>
                  {pl.side.text}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </NoteCard>
    </SceneShell>
  );
};
