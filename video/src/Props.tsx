// Evidence props for the hook frame (script scene "poster_prop", composition.json "posterProps"): one object that
// shows the episode's scam method, readable at grid size, taped on the wall beside the character of a solo shot.
// Generic and invented: no agency name or mark, no logo, the name and the number masked (●), an undecodable code
// square. Static (a still object in the room); it moves only with the camera.
import React from "react";
import {Phone} from "lucide-react";
import COMP from "./composition.json";
import {FONT} from "./fonts";
import {strSeed, hash01} from "./rig";
import {DRAMA} from "./themes";
import {PosterProp} from "./types";

export const POSTER_PROPS = COMP.posterProps;

/** A square of blocks that looks like a scan code but encodes nothing (three corner squares + seeded blocks). */
const CodeSquare: React.FC<{size: number; ink: string; seed: number}> = ({size, ink, seed}) => {
  const n = 9;
  const c = size / n;
  const finder = (x: number, y: number) => (
    <g key={`${x}${y}`}>
      <rect x={x * c} y={y * c} width={3 * c} height={3 * c} fill={ink} />
      <rect x={x * c + c * 0.5} y={y * c + c * 0.5} width={2 * c} height={2 * c} fill="#FFFFFF" />
      <rect x={x * c + c} y={y * c + c} width={c} height={c} fill={ink} />
    </g>
  );
  const inFinder = (i: number, j: number) => (i < 3 && j < 3) || (i >= n - 3 && j < 3) || (i < 3 && j >= n - 3);
  return (
    <svg width={size} height={size} style={{display: "block", background: "#FFFFFF"}}>
      {Array.from({length: n * n}, (_, k) => {
        const i = k % n;
        const j = Math.floor(k / n);
        return !inFinder(i, j) && hash01(seed, k) > 0.52
          ? <rect key={k} x={i * c} y={j * c} width={c} height={c} fill={ink} /> : null;
      })}
      {finder(0, 0)}
      {finder(n - 3, 0)}
      {finder(0, n - 3)}
    </svg>
  );
};

/** The generic "우편물 도착 안내서" (a delivery-attempt notice): a heading, a red registered-mail seal, masked form rows
 * with the redelivery number marked, a code square; two strips of tape at the top. */
const MailNotice: React.FC<{w: number; h: number}> = ({w, h}) => {
  const c = DRAMA.notice;
  const row = (label: string, value: React.ReactNode, mark = false) => (
    <div style={{display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `2px solid ${c.muted}33`}}>
      <div style={{width: 100, flex: "0 0 auto", fontSize: 23, fontWeight: 700, color: c.muted, whiteSpace: "nowrap"}}>
        {label}</div>
      <div style={{fontSize: mark ? 25 : 28, fontWeight: 900, color: c.ink, whiteSpace: "nowrap", display: "flex",
        alignItems: "center", gap: 4, letterSpacing: mark ? -1.5 : 0, padding: mark ? "0 4px" : undefined,
        background: mark ? `linear-gradient(transparent 48%, ${c.mark} 48%, ${c.mark} 92%, transparent 92%)` : undefined}}>
        {value}</div>
    </div>
  );
  return (
    <div style={{position: "relative", width: w, height: h, fontFamily: FONT, wordBreak: "keep-all"}}>
      <div style={{position: "absolute", inset: 0, background: c.paper, borderRadius: 6,
        boxShadow: "0 16px 30px rgba(0,0,0,0.28), 0 2px 0 rgba(0,0,0,0.08)", padding: "26px 24px 20px",
        boxSizing: "border-box", display: "flex", flexDirection: "column"}}>
        {/* the form's double rule */}
        <div style={{height: 9, background: c.rule, borderRadius: 2}} />
        <div style={{height: 3, background: c.rule, marginTop: 4, opacity: 0.6}} />
        <div style={{marginTop: 14, fontSize: 35, fontWeight: 900, color: c.ink, letterSpacing: -1, whiteSpace: "nowrap"}}>
          우편물 도착 안내서</div>
        <div style={{marginTop: 2, fontSize: 23, fontWeight: 700, color: c.muted}}>부재중 방문 안내</div>
        <div style={{marginTop: 12}}>
          {row("받는 분", "●●● 님")}
          {row("방문 일시", "●월 ●일")}
          {row("재배달 문의", <><Phone size={24} color={c.ink} strokeWidth={2.8} />●●●●-●●●●</>, true)}
        </div>
        <div style={{marginTop: "auto", display: "flex", alignItems: "center", gap: 16}}>
          <div style={{padding: 6, border: `2px solid ${c.ink}`, borderRadius: 4, background: "#FFFFFF"}}>
            <CodeSquare size={76} ink={c.ink} seed={strSeed("mail_notice")} />
          </div>
          <div style={{fontSize: 24, fontWeight: 800, color: c.ink, lineHeight: 1.25}}>찍으면<br />간편 재배달</div>
        </div>
      </div>
      {/* the registered-mail seal */}
      <div style={{position: "absolute", right: 22, bottom: 26, width: 74, height: 74, borderRadius: 12,
        border: `5px solid ${c.seal}`, color: c.seal, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 27, fontWeight: 900, transform: "rotate(-12deg)", opacity: 0.88, background: `${c.paper}cc`}}>등기</div>
      {/* tape */}
      {[[-26, -14, -14], [w - 84, -12, 12]].map(([x, y, r], k) => (
        <div key={k} style={{position: "absolute", left: x, top: y, width: 110, height: 34, background: c.tape,
          transform: `rotate(${r}deg)`, boxShadow: "0 1px 2px rgba(0,0,0,0.12)"}} />
      ))}
    </div>
  );
};

/** A poster prop at its composition.json box (screen px), slightly rotated. */
export const PosterPropView: React.FC<{kind: PosterProp}> = ({kind}) => {
  const b = POSTER_PROPS[kind];
  if (!b) return null;
  return (
    <div style={{position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, transform: `rotate(${b.rotate}deg)`,
      transformOrigin: "50% 0%"}}>
      {kind === "mail_notice" ? <MailNotice w={b.w} h={b.h} /> : null}
    </div>
  );
};
