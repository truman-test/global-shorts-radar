// Review sheet (not part of a Short): the fox in every disguise (composition.json "costumes": a bust row as the call
// window / aside crop him, a full-figure row with the props and the tail), or the caller's rooms (composition.json
// "villainSets": each room at a third of the frame with the fox in the caller's bust shot behind its own prop).
// Rendered with `npx remotion still src/index.ts VillainLineup out.png --props='{"mode":"sets"}'`.
import React from "react";
import {AbsoluteFill} from "remotion";
import {AnimalCharacter} from "./Animal";
import {bodyOf} from "./Body";
import COMP from "./composition.json";
import {FONT} from "./fonts";
import {neckY, SPEC} from "./rig";
import {ForegroundProp, VILLAIN, VillainSetView} from "./Sets";
import {CharacterId, CostumeId, Expression, Gesture, VillainSet} from "./types";

export type VillainLineupProps = {mode: "costumes" | "sets"; id?: CharacterId; expr?: Expression; gesture?: Gesture;
  costume?: CostumeId};

export const COSTUMES = COMP.costumes as CostumeId[];
export const VILLAIN_SETS = Object.keys(COMP.villainSets) as VillainSet[];
export const VCELL = {w: 300, bust: 400, full: 420, label: 50, set: 0.32};

const LABEL: Record<string, string> = {hoodie: "후드티", bank_suit: "은행원 정장", investigator: "수사관 코트",
  courier: "택배 기사", guru: "투자 고수", lecturer: "부업 강사", family_mask: "아들 가면", callcentre: "콜센터",
  fake_office: "가짜 사무실", studio: "가짜 방송 스튜디오", car: "밤의 차 안", lecture_room: "세미나 무대"};

export const villainLineupSize = (p: VillainLineupProps) => (p.mode === "sets"
  ? {width: Math.round(1080 * VCELL.set) * VILLAIN_SETS.length, height: Math.round(1920 * VCELL.set) + VCELL.label}
  : {width: VCELL.w * COSTUMES.length, height: VCELL.bust + VCELL.full + VCELL.label});

const Label: React.FC<{text: string; top: number; w: number}> = ({text, top, w}) => (
  <div style={{position: "absolute", left: 0, width: w, top, height: VCELL.label, display: "flex", alignItems: "center",
    justifyContent: "center", fontFamily: FONT, fontWeight: 800, fontSize: 23, color: "#F3EEE6", whiteSpace: "nowrap"}}>{text}</div>
);

export const VillainLineup: React.FC<VillainLineupProps> = ({mode, id = "scammer", expr = "smug", gesture = "rest",
  costume}) => {
  if (mode === "sets") {
    const s = VCELL.set;
    const w = Math.round(1080 * s);
    const h = Math.round(1920 * s);
    const spot = SPEC.solo.shots.caller.chars[0];
    const top = SPEC.solo.shots.caller.prop.top;
    return (
      <AbsoluteFill style={{background: "#15171E"}}>
        {VILLAIN_SETS.map((set, i) => (
          <div key={set} style={{position: "absolute", left: i * w, top: 0, width: w, height: h + VCELL.label}}>
            <div style={{position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${s})`,
              transformOrigin: "0 0", overflow: "hidden"}}>
              <VillainSetView set={set} w={1080} h={1920} frame={0} />
              <AnimalCharacter uid={`vs${i}`} frame={0} pose={{id, x: spot.x, y: neckY(spot.eyeY, spot.k), k: spot.k,
                expr, gesture, turn: spot.turn, look: [-0.2, 0.1], rim: VILLAIN[set].rim, rimWidth: 7, monitor: 1,
                light: VILLAIN[set].light, costume}} />
              <ForegroundProp kind={VILLAIN[set].prop} top={top} mode="dark" />
            </div>
            <Label text={`${set} · ${LABEL[set]}`} top={h} w={w} />
          </div>
        ))}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{background: "#1E2230"}}>
      {COSTUMES.map((cos, i) => {
        const B = bodyOf(id);
        const kb = 0.62;
        const kf = 0.31;
        const fullTop = VCELL.bust;
        const floor = fullTop + VCELL.full - 18;
        return (
          <div key={cos} style={{position: "absolute", left: i * VCELL.w, top: 0, width: VCELL.w,
            height: VCELL.bust + VCELL.full + VCELL.label, borderRight: "2px solid rgba(243,238,230,0.12)"}}>
            <div style={{position: "absolute", left: 0, top: 0, width: VCELL.w, height: VCELL.bust, overflow: "hidden",
              background: "#262B3A"}}>
              <AnimalCharacter uid={`vb${i}`} frame={0} box={{w: VCELL.w, h: VCELL.bust}} pose={{id, x: VCELL.w / 2,
                y: neckY(235, kb), k: kb, expr, gesture, turn: 0.12, look: [0, 0], rim: "#EEE8DE", rimWidth: 4,
                costume: cos}} />
            </div>
            <div style={{position: "absolute", left: 0, top: fullTop, width: VCELL.w, height: VCELL.full, overflow: "hidden"}}>
              <AnimalCharacter uid={`vf${i}`} frame={0} box={{w: VCELL.w, h: VCELL.full}} pose={{id, x: VCELL.w / 2 + 20,
                y: floor - fullTop - B.sole * kf, k: kf, expr, gesture: cos === "guru" ? "point" : gesture, turn: 0.12,
                look: [0, 0], rim: "#EEE8DE", rimWidth: 3, tail: true, costume: cos}} />
            </div>
            <Label text={`${cos} · ${LABEL[cos]}`} top={VCELL.bust + VCELL.full} w={VCELL.w} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
