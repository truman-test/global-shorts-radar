// Review sheet (not part of a Short): the cast in a grid, one column per character, one row per expression/gesture,
// in either skin. Rendered with `npx remotion still src/index.ts CastLineup out.png --props=...` for A/B reviews.
// `full`: one row of whole figures standing on a floor line, with a ruler in head heights (the SD proportions).
import React from "react";
import {AbsoluteFill} from "remotion";
import {Character} from "./Actor";
import {bodyOf} from "./Body";
import {FONT} from "./fonts";
import {neckY, RIG} from "./rig";
import {CastStyle, CharacterId, Expression, Gesture} from "./types";

export type LineupProps = {castStyle: CastStyle; ids: CharacterId[]; rows: {expr: Expression; gesture: Gesture;
  talking?: boolean; mouth?: number; view?: "front" | "back"}[]; dark?: boolean; full?: boolean};

export const CELL = {w: 360, h: 460};
/** The full-body lineup: cell size, scale and floor line. */
export const FULL = {w: 300, h: 760, k: 0.5, floor: 700, ruler: 90};

const H = RIG.head.chin - RIG.head.top;

export const Lineup: React.FC<LineupProps> = ({castStyle, ids, rows, dark, full}) => {
  if (full) {
    const r = rows[0];
    const k = FULL.k;
    const ink = dark ? "#EEE8DE" : "#2B2620";
    const top = (id: CharacterId) => FULL.floor - (bodyOf(id).sole - RIG.head.top) * k;
    const parentTop = top("father");
    return (
      <AbsoluteFill style={{background: dark ? "#1E2230" : "#F4EEE2"}}>
        {/* the ruler: head heights up from the floor */}
        <svg width={FULL.ruler} height={FULL.h} style={{position: "absolute", left: 0, top: 0}}>
          {Array.from({length: 4}, (_, i) => {
            const y = FULL.floor - i * H * k;
            return (
              <g key={i}>
                <path d={`M 50 ${y} H ${FULL.ruler}`} stroke={ink} strokeWidth={3} />
                <text x={44} y={y + 9} textAnchor="end" fontFamily={FONT} fontWeight={800} fontSize={26} fill={ink}>{i}</text>
              </g>
            );
          })}
          <path d={`M 70 ${FULL.floor} V ${FULL.floor - 3.2 * H * k}`} stroke={ink} strokeWidth={3} />
        </svg>
        {Array.from({length: 4}, (_, i) => (
          <div key={i} style={{position: "absolute", left: FULL.ruler, right: 0, top: FULL.floor - i * H * k - 1, height: 2,
            background: ink, opacity: i === 0 ? 0.5 : 0.14}} />
        ))}
        <div style={{position: "absolute", left: FULL.ruler, right: 0, top: parentTop - 1, height: 2,
          borderTop: `2px dashed ${ink}`, opacity: 0.3}} />
        {ids.map((id, i) => {
          const B = bodyOf(id);
          const pose = {id, x: FULL.w / 2, y: FULL.floor - B.sole * k, k, expr: r.expr, gesture: r.gesture,
            talking: r.talking, mouth: r.mouth, view: r.view, fx: [], turn: 0.12, rim: dark ? "#EEE8DE" : undefined,
            rimWidth: 4, look: [0, 0] as [number, number], tail: true};
          const heads = (B.sole - RIG.head.top) / H;
          return (
            <div key={id} style={{position: "absolute", left: FULL.ruler + i * FULL.w, top: 0, width: FULL.w, height: FULL.h}}>
              <Character pose={pose} uid={`lf${i}`} box={{w: FULL.w, h: FULL.h}} frame={0} skin={castStyle} />
              <div style={{position: "absolute", left: 0, right: 0, top: FULL.floor + 12, textAlign: "center",
                fontFamily: FONT, fontWeight: 800, fontSize: 26, color: ink}}>{heads.toFixed(1)}등신</div>
            </div>
          );
        })}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{background: dark ? "#1E2230" : "#F4EEE2"}}>
      {rows.map((r, j) => ids.map((id, i) => {
        const k = 0.6;
        const pose = {id, x: CELL.w / 2, y: neckY(250, k), k, expr: r.expr, gesture: r.gesture, talking: r.talking,
          mouth: r.mouth, view: r.view, fx: [], turn: 0.12, rim: dark ? "#EEE8DE" : undefined, rimWidth: 5, look: [0, 0] as [number, number]};
        return (
          <div key={`${i}-${j}`} style={{position: "absolute", left: i * CELL.w, top: j * CELL.h, width: CELL.w,
            height: CELL.h, overflow: "hidden", borderRight: "2px solid rgba(43,38,32,0.12)",
            borderBottom: "2px solid rgba(43,38,32,0.12)"}}>
            <Character pose={pose} uid={`ln${i}-${j}`} box={{w: CELL.w, h: CELL.h}} frame={0} skin={castStyle} />
          </div>
        );
      }))}
    </AbsoluteFill>
  );
};
