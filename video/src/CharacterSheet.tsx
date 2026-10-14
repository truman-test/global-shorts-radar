// The registry's review sheet (not part of a Short): every registry character (content/characters) or a list of ids,
// one column each: a name card (label, id, species, kind, voice), three busts (neutral, worried on the phone, shocked)
// and the whole figure on a floor line with the 3-head ruler. The character designer renders it for every new
// character (content/characters/README.md):
//   npx remotion still src/index.ts CharacterSheet out.png --props='{"ids":["cat_guard"]}'
// `specs`: draft specs straight from the props (not yet in the folder); `dark`: the dark stage with the rim light.
// Pure function of the props: no network, frame 0.
import React from "react";
import {AbsoluteFill} from "remotion";
import {Character} from "./Actor";
import {FONT} from "./fonts";
import {bodyOfSpec, REGISTRY, registryIds} from "./registry";
import {neckY, RIG} from "./rig";
import {CharacterSpec, Expression, Gesture} from "./types";

export type CharacterSheetProps = {ids?: string[]; specs?: CharacterSpec[]; dark?: boolean; perRow?: number;
  rows?: {expr: Expression; gesture: Gesture; talking?: boolean; mouth?: number}[]};

export const SHEET = {w: 340, label: 118, bust: 400, full: 530, k: 0.56, kf: 0.4, perRow: 6};
const ROWS: NonNullable<CharacterSheetProps["rows"]> = [{expr: "neutral", gesture: "rest"},
  {expr: "worried", gesture: "phoneEar", talking: true, mouth: 2}, {expr: "shocked", gesture: "handsOnCheeks"}];
const KIND: Record<string, string> = {family: "가족", caller: "사기꾼 쪽", other: "주변 인물", presenter: "광고"};
const SPECIES: Record<string, string> = {dog: "진돗개", fox: "여우", cat: "고양이", rabbit: "토끼", bear: "반달곰",
  raccoon: "너구리"};

/** The specs on the sheet: the given drafts, then the ids (default: the whole registry). */
export const sheetSpecs = (p: CharacterSheetProps): CharacterSpec[] => {
  const drafts = p.specs ?? [];
  const ids = p.ids ?? (drafts.length ? [] : registryIds());
  return [...drafts, ...ids.filter((id) => REGISTRY[id] && !drafts.some((d) => d.id === id)).map((id) => REGISTRY[id])];
};

export const sheetSize = (p: CharacterSheetProps) => {
  const n = Math.max(1, sheetSpecs(p).length);
  const per = Math.min(n, p.perRow ?? SHEET.perRow);
  const rows = (p.rows ?? ROWS).length;
  const band = SHEET.label + rows * SHEET.bust + SHEET.full;
  return {width: per * SHEET.w, height: Math.ceil(n / per) * band};
};

export const CharacterSheet: React.FC<CharacterSheetProps> = (props) => {
  const specs = sheetSpecs(props);
  const rows = props.rows ?? ROWS;
  const per = Math.min(Math.max(1, specs.length), props.perRow ?? SHEET.perRow);
  const band = SHEET.label + rows.length * SHEET.bust + SHEET.full;
  const dark = Boolean(props.dark);
  const ink = dark ? "#EEE8DE" : "#2B2620";
  const H = RIG.head.chin - RIG.head.top;
  const floor = SHEET.full - 40;
  return (
    <AbsoluteFill style={{background: dark ? "#1E2230" : "#F4EEE2"}}>
      {specs.map((S, i) => {
        const left = (i % per) * SHEET.w;
        const top = Math.floor(i / per) * band;
        const B = bodyOfSpec(S);
        const heads = (B.sole - RIG.head.top) / H;
        const cell = {position: "absolute" as const, left: 0, width: SHEET.w, overflow: "hidden" as const,
          borderBottom: `2px solid ${dark ? "rgba(238,232,222,0.12)" : "rgba(43,38,32,0.12)"}`};
        return (
          <div key={S.id} style={{position: "absolute", left, top, width: SHEET.w, height: band,
            borderRight: `2px solid ${dark ? "rgba(238,232,222,0.12)" : "rgba(43,38,32,0.12)"}`}}>
            <div style={{...cell, top: 0, height: SHEET.label, padding: "14px 18px", boxSizing: "border-box",
              fontFamily: FONT, color: ink}}>
              <div style={{fontWeight: 900, fontSize: 38, lineHeight: 1.1, wordBreak: "keep-all", whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis"}}>{S.label}</div>
              <div style={{fontWeight: 700, fontSize: 20, opacity: 0.75, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden",
                textOverflow: "ellipsis"}}>{S.id}</div>
              <div style={{fontWeight: 700, fontSize: 19, opacity: 0.6, marginTop: 2, whiteSpace: "nowrap"}}>
                {SPECIES[S.species] ?? S.species} · {KIND[S.role_kind] ?? S.role_kind}{S.voice ? ` · ${S.voice}` : ""}
                {` · ${heads.toFixed(1)}등신`}
              </div>
            </div>
            {rows.map((r, j) => {
              const pose = {id: S.id, spec: S, x: SHEET.w / 2, y: neckY(225, SHEET.k), k: SHEET.k, expr: r.expr,
                gesture: r.gesture, talking: r.talking, mouth: r.mouth, fx: [], turn: 0.12, look: [0, 0] as [number, number],
                rim: dark ? "#EEE8DE" : undefined, rimWidth: 4};
              return (
                <div key={j} style={{...cell, top: SHEET.label + j * SHEET.bust, height: SHEET.bust}}>
                  <Character pose={pose} uid={`cs${i}-${j}`} box={{w: SHEET.w, h: SHEET.bust}} frame={0} skin="animal" />
                </div>
              );
            })}
            <div style={{...cell, top: SHEET.label + rows.length * SHEET.bust, height: SHEET.full, borderBottom: "none"}}>
              {/* the 3-head ruler and the floor line */}
              {Array.from({length: 4}, (_, h) => (
                <div key={h} style={{position: "absolute", left: 0, right: 0, top: floor - h * H * SHEET.kf - 1, height: 2,
                  background: ink, opacity: h === 0 ? 0.45 : 0.12}} />
              ))}
              <Character pose={{id: S.id, spec: S, x: SHEET.w / 2 + 24, y: floor - B.sole * SHEET.kf, k: SHEET.kf,
                expr: "excited", gesture: "rest", fx: [], turn: 0.12, look: [0, 0], tail: true,
                rim: dark ? "#EEE8DE" : undefined, rimWidth: 3}} uid={`csf${i}`} box={{w: SHEET.w, h: SHEET.full}} frame={0}
                skin="animal" />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
