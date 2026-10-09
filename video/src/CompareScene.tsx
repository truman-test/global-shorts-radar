import React from "react";
import {Check, X} from "lucide-react";
import {useCurrentFrame, useVideoConfig} from "remotion";
import {drawn, handCheck, handCross, HandCircle, seedOf} from "./hand";
import {BODY_BOTTOM, BODY_TOP, NoteCard, SceneHeader, SceneShell, TonePill} from "./kit";
import {spr} from "./motion";
import {COMPARE_IN, compareBeats} from "./schedule";
import {NOTE, Tone, TONES} from "./themes";
import {CompareSide, SceneProps} from "./types";

const W = 430;
const MARK = 112;
const FIELD_W = W - 60 - 44; // text width inside the title field

/** Rough rendered width in em (digits, dashes and masks are narrower or wider than Hangul). */
const em = (s: string) => [...s].reduce((a, ch) => a + (/[0-9a-zA-Z]/.test(ch) ? 0.6 : /[-.:/]/.test(ch) ? 0.4
  : ch === " " ? 0.28 : 0.95), 0);

/** Title field: a number/link (no spaces) stays on one line and shrinks to fit; words wrap at 40 px. */
const titleFit = (s: string) => {
  if (/\s/.test(s)) return {size: 40, lines: em(s) * 40 > FIELD_W ? 2 : 1, nowrap: false};
  return {size: Math.max(28, Math.min(40, Math.floor(FIELD_W / Math.max(1, em(s))))), lines: 1, nowrap: true};
};

/** Card height for one side: pill, title field, points (about 10 characters per line), the verdict mark. */
const cardHeight = (side: CompareSide) => {
  const fit = titleFit(side.title);
  const points = side.points.reduce((a, p) => a + Math.ceil(em(p) / 9.4) * 47 + 16, 0);
  return 34 + 62 + 26 + (36 + fit.lines * fit.size * 1.3) + 26 + points + MARK + 30;
};

const Side: React.FC<{side: CompareSide; left: number; top: number; height: number; tone: Tone; real: boolean;
  enter: number; mark: number; circle: number; shake: number}> = ({side, left, top, height, tone, real, enter, mark,
  circle, shake}) => {
  const fit = titleFit(side.title);
  const fieldH = 36 + fit.lines * fit.size * 1.3;
  const seed = seedOf(side.title);
  const check = handCheck(MARK, seed);
  const [c1, c2] = handCross(MARK, seed);
  const Icon = real ? Check : X;
  return (
    <NoteCard box={{top, left, width: W, height, opacity: Math.min(1, enter * 1.4),
      transform: `translateY(${(1 - enter) * 70}px) translateX(${shake}px) rotate(${real ? -0.6 : 0.7}deg)`}} fold={44}>
      <div style={{position: "absolute", inset: "34px 30px 30px", display: "flex", flexDirection: "column", gap: 26}}>
        <div>
          <TonePill tone={tone} size={36}><Icon size={38} strokeWidth={3.2} color={tone.onSolid} />{side.label}</TonePill>
        </div>
        <div style={{position: "relative"}}>
          <div style={{height: fieldH, boxSizing: "border-box", padding: "18px 22px", borderRadius: 18,
            background: tone.tint, color: NOTE.ink, fontSize: fit.size, fontWeight: 800, lineHeight: 1.3,
            whiteSpace: fit.nowrap ? "nowrap" : "normal", display: "flex", alignItems: "center"}}>
            {side.title}
          </div>
          {!real ? <HandCircle p={circle} color={TONES.danger.fill} seed={seed + 1} w={W - 60} h={fieldH} pad={18}
            width={7} /> : null}
        </div>
        <div style={{display: "flex", flexDirection: "column", gap: 16}}>
          {side.points.map((pt, k) => (
            <div key={k} style={{display: "flex", gap: 14, alignItems: "flex-start", fontSize: 36, fontWeight: 700,
              lineHeight: 1.3, color: NOTE.ink}}>
              <div style={{flex: "0 0 auto", width: 14, height: 14, marginTop: 17, borderRadius: 4, background: tone.fill}} />
              <div>{pt}</div>
            </div>
          ))}
        </div>
      </div>
      {/* the verdict, drawn by hand in the corner */}
      <svg width={MARK} height={MARK} style={{position: "absolute", right: 34, bottom: 30, overflow: "visible"}}>
        {real ? (
          <path {...drawn(check, mark)} stroke={tone.fill} strokeWidth={13} />
        ) : (
          <>
            <path {...drawn(c1, mark * 2)} stroke={tone.fill} strokeWidth={13} />
            <path {...drawn(c2, mark * 2 - 1)} stroke={tone.fill} strokeWidth={13} />
          </>
        )}
      </svg>
    </NoteCard>
  );
};

/**
 * 진짜 vs 가짜: two small note cards side by side (the genuine one left, the fake one right). Once they have
 * landed, a green check is drawn on the genuine card, a red cross on the fake one (it gives a small shake), and
 * the fake card's key line is circled by hand.
 */
export const CompareScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const [b0, b1, b2] = compareBeats(scene, fps);
  const real = scene.real ?? {label: "진짜", title: "", points: []};
  const fake = scene.fake ?? {label: "가짜", title: "", points: []};
  const shakeT = frame - b1;
  const shake = shakeT > 0 && shakeT < 12 ? Math.sin(shakeT * 2.2) * 8 * (1 - shakeT / 12) : 0;
  const height = Math.min(640, Math.max(440, cardHeight(real), cardHeight(fake)));
  const top = BODY_TOP + (BODY_BOTTOM - BODY_TOP - height) / 2 + 8;
  return (
    <SceneShell>
      <SceneHeader scene={scene} />
      <Side side={real} left={102} top={top} height={height} tone={TONES.safe} real enter={spr(frame, COMPARE_IN[0], 14, 0.02)}
        mark={Math.min(1, spr(frame, b0, 12, 0))} circle={0} shake={0} />
      <Side side={fake} left={548} top={top} height={height} tone={TONES.danger} real={false} enter={spr(frame, COMPARE_IN[1], 14, 0.02)}
        mark={Math.min(1, spr(frame, b1, 12, 0))} circle={Math.min(1, spr(frame, b2, 16, 0))} shake={shake} />
    </SceneShell>
  );
};
