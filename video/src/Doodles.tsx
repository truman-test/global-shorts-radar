// Line-art props per topic category, drawn in ink on the notebook stages (our own simple shapes, 100x100 boxes).
// Each stroke reveals with strokeDashoffset (pathLength = 1), then a light tint fills the shape.
import React from "react";
import {interpolate, useCurrentFrame} from "remotion";
import {clamp} from "./kit";
import {CATEGORIES, CategoryName, NOTE, useCategory} from "./themes";

type Doodle = {fill?: string; strokes: string[]}; // fill: the outline that gets the tint

const DOODLES: Record<CategoryName, [Doodle, Doodle]> = {
  voice: [
    {fill: "M30 18 C22 20 17 28 21 39 C29 62 41 74 62 81 C72 84 81 79 81 70 L71 60 C67 57 62 59 60 64 C50 60 42 52 38 41 C43 39 45 35 43 30 Z",
      strokes: ["M30 18 C22 20 17 28 21 39 C29 62 41 74 62 81 C72 84 81 79 81 70 L71 60 C67 57 62 59 60 64 C50 60 42 52 38 41 C43 39 45 35 43 30 Z",
        "M58 22 Q72 26 76 40", "M60 10 Q84 16 88 40"]},
    {fill: "M14 24 Q14 14 24 14 L80 14 Q90 14 90 24 L90 56 Q90 66 80 66 L46 66 L28 84 L32 66 L24 66 Q14 66 14 56 Z",
      strokes: ["M14 24 Q14 14 24 14 L80 14 Q90 14 90 24 L90 56 Q90 66 80 66 L46 66 L28 84 L32 66 L24 66 Q14 66 14 56 Z",
        "M36 40 L37 40", "M52 40 L53 40", "M68 40 L69 40"]},
  ],
  ai: [
    {fill: "M50 8 Q55 43 92 50 Q55 57 50 92 Q45 57 8 50 Q45 43 50 8 Z",
      strokes: ["M50 8 Q55 43 92 50 Q55 57 50 92 Q45 57 8 50 Q45 43 50 8 Z", "M82 10 L82 26", "M74 18 L90 18"]},
    {fill: "M12 20 L88 20 L88 80 L12 80 Z",
      strokes: ["M12 20 L88 20 L88 80 L12 80 Z", "M18 72 L38 48 L52 62 L62 52 L82 72", "M66 32 a7 7 0 1 0 0.1 0"]},
  ],
  security: [
    {fill: "M50 8 L84 20 L80 56 Q74 78 50 92 Q26 78 20 56 L16 20 Z",
      strokes: ["M50 8 L84 20 L80 56 Q74 78 50 92 Q26 78 20 56 L16 20 Z", "M33 50 L46 63 L69 37"]},
    {fill: "M24 46 L76 46 L76 88 L24 88 Z",
      strokes: ["M24 46 L76 46 L76 88 L24 88 Z", "M34 46 L34 32 Q34 14 50 14 Q66 14 66 32 L66 46", "M50 60 L50 72"]},
  ],
  smishing: [
    {fill: "M10 24 L90 24 L90 78 L10 78 Z",
      strokes: ["M10 24 L90 24 L90 78 L10 78 Z", "M10 26 L50 56 L90 26", "M84 10 L92 2", "M90 16 L98 12"]},
    {strokes: ["M42 58 L26 74 Q16 84 8 76 Q0 68 10 58 L26 42 Q34 34 42 40", "M58 42 L74 26 Q84 16 92 24 Q100 32 90 42 L74 58 Q66 66 58 60",
      "M40 60 L60 40"]},
  ],
};

/** One doodle at (x, y) (centre), `size` px, drawn from frame `at` over ~14 frames, slightly tilted. */
export const DoodleProp: React.FC<{which: 0 | 1; x: number; y: number; size: number; at: number; tilt?: number;
  ink?: string}> = ({which, x, y, size, at, tilt = 0, ink = NOTE.ink}) => {
  const frame = useCurrentFrame();
  const cat = useCategory();
  const d = DOODLES[cat][which];
  // drawn within ~13 frames, so a poster (frame 24) shows them finished
  const per = 10 / d.strokes.length;
  const fillIn = interpolate(frame, [at + 8, at + 14], [0, 0.85], clamp);
  const float = Math.sin((frame + which * 40) / 22) * 4;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{position: "absolute", left: x - size / 2,
      top: y - size / 2 + float, overflow: "visible", transform: `rotate(${tilt}deg)`, pointerEvents: "none"}}>
      {d.fill ? <path d={d.fill} fill={CATEGORIES[cat].tint} opacity={fillIn} /> : null}
      {d.strokes.map((s, k) => {
        const p = interpolate(frame, [at + k * per, at + (k + 1) * per + 3], [0, 1], clamp);
        return (
          <path key={k} d={s} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - p} fill="none"
            stroke={ink} strokeOpacity={0.82} strokeWidth={4.4} strokeLinecap="round" strokeLinejoin="round"
            opacity={p > 0 ? 1 : 0} />
        );
      })}
    </svg>
  );
};
