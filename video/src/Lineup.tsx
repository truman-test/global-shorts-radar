// Review sheet (not part of a Short): the cast in a grid, one column per character, one row per expression/gesture,
// in either skin. Rendered with `npx remotion still src/index.ts CastLineup out.png --props=...` for A/B reviews.
import React from "react";
import {AbsoluteFill} from "remotion";
import {Character} from "./Actor";
import {neckY} from "./rig";
import {CastStyle, CharacterId, Expression, Gesture} from "./types";

export type LineupProps = {castStyle: CastStyle; ids: CharacterId[]; rows: {expr: Expression; gesture: Gesture;
  talking?: boolean; mouth?: number; view?: "front" | "back"}[]; dark?: boolean};

export const CELL = {w: 360, h: 460};

export const Lineup: React.FC<LineupProps> = ({castStyle, ids, rows, dark}) => (
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
