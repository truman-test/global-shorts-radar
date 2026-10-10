// The four widened notebook stages (종이 노트 family), all procedural SVG/CSS. Layouts are computed once per episode
// seed (useMemo) and stay static; only a few small things move, slowly, as pure functions of the frame. No animated
// blurs, few paths. Each stage keeps the caption band (y ~1255-1560) calm and the top bar readable; the colours the
// captions, brand line, handwriting and 도치 actually sit on are declared in tokens.json "contrastSamples" and
// checked by tests/test_design_tokens.py.
import React, {useMemo} from "react";
import {AbsoluteFill, interpolateColors} from "remotion";
import {CAPTION_CALM, H, KRAFT_FIBRES, KRAFT_FLECKS, PAPER_FIBRES, PaperGrain, rng, W} from "./textures";
import {CATEGORIES, CategoryName, SkyState, Theme, TONES} from "./themes";

const f1 = (v: number) => v.toFixed(1);

/* ================================================================== night-lamp: a lamp-lit page on a dark desk */

/** The page (screen px, before its slight tilt) and the lamp's light pool; 도치's slot sits inside the pool. */
const LAMP_PAGE = {left: 30, top: 206, width: 1020, height: 1032, tilt: -0.8};
const POOL = {x: 500, y: 720, rx: 860, ry: 1010};

const woodGrain = (seed: number) => {
  const r = rng(seed ^ 0x51a3);
  const out: string[] = [];
  for (let k = 0; k < 13; k++) {
    const y0 = 30 + k * 148 + r() * 50;
    let d = `M-30 ${f1(y0)}`;
    for (let x = -30; x < W + 60; x += 230) {
      const y = y0 + Math.sin(x / 310 + k) * 9 + (r() - 0.5) * 12;
      d += ` Q${f1(x + 115)} ${f1(y + (r() - 0.5) * 20)} ${f1(x + 230)} ${f1(y)}`;
    }
    out.push(d);
  }
  return out.join(" ");
};

const Lamp: React.FC = () => (
  <svg width={W} height={H} style={{position: "absolute", inset: 0, overflow: "visible"}}>
    <defs>
      <radialGradient id="lampBulb" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#FFF4D6" />
        <stop offset="0.55" stopColor="#FFE0A6" />
        <stop offset="1" stopColor="#FFC56E" stopOpacity={0} />
      </radialGradient>
    </defs>
    <g transform="translate(104 66) rotate(-31)">
      {/* arm (runs off the frame) */}
      <path d="M-6 -70 L-10 -330" stroke="#24201C" strokeWidth={16} strokeLinecap="round" />
      <path d="M-2 -70 L-6 -330" stroke="rgba(255,220,170,0.12)" strokeWidth={3} />
      {/* soft glow at the mouth, the shade (dome opening downwards), the bulb rim */}
      <ellipse cx={0} cy={6} rx={118} ry={44} fill="url(#lampBulb)" opacity={0.65} />
      <path d="M-74 0 Q-70 -64 0 -76 Q70 -64 74 0 Z" fill="#2C2722" stroke="#4A4139" strokeWidth={3} />
      <path d="M-56 -16 Q-50 -54 -6 -64" stroke="rgba(255,230,190,0.22)" strokeWidth={4} fill="none"
        strokeLinecap="round" />
      <ellipse cx={0} cy={0} rx={72} ry={13} fill="#FFE9BE" />
      <ellipse cx={0} cy={1} rx={46} ry={7} fill="#FFF8E6" />
    </g>
  </svg>
);

export const NightLamp: React.FC<{seed: number}> = ({seed}) => {
  const grain = useMemo(() => woodGrain(seed), [seed]);
  const P = LAMP_PAGE;
  return (
    <>
      {/* desk: a few long, faint wood strokes */}
      <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
        <path d={grain} fill="none" stroke="rgba(255,226,190,0.035)" strokeWidth={3} />
        <path d={grain} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={1.5} transform="translate(0 7)" />
      </svg>
      {/* warm spill of the lamp on the desk around the page */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse ${POOL.rx}px ${POOL.ry}px at ${POOL.x}px ${POOL.y}px, `
        + "rgba(255,176,96,0.18) 0%, rgba(255,176,96,0.08) 50%, rgba(255,176,96,0) 78%)"}} />
      {/* the notebook page: cream, faint rules, a margin line, punched holes, its static shadow on the desk */}
      <div style={{position: "absolute", left: P.left, top: P.top, width: P.width, height: P.height,
        transform: `rotate(${P.tilt}deg)`, borderRadius: 8, overflow: "hidden", background: "#F7EEDB",
        boxShadow: "0 30px 60px rgba(0,0,0,0.6), 0 6px 14px rgba(0,0,0,0.45)"}}>
        <div style={{position: "absolute", inset: 0, backgroundImage:
          "repeating-linear-gradient(180deg, transparent 0px, transparent 66px, rgba(70,100,150,0.12) 66px, rgba(70,100,150,0.12) 68px)",
          backgroundPosition: "0 104px", backgroundSize: "100% 68px", backgroundRepeat: "repeat-y",
          maskImage: "linear-gradient(180deg, transparent 0px, transparent 104px, #000 110px)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0px, transparent 104px, #000 110px)"}} />
        <div style={{position: "absolute", left: 92, top: 0, bottom: 0, width: 2, background: "rgba(200,80,70,0.26)"}} />
        <div style={{position: "absolute", inset: 0, backgroundImage: `url("${PAPER_FIBRES}")`, backgroundSize: "300px 300px",
          mixBlendMode: "multiply", opacity: 0.3}} />
        {[960].map((y) => (
          <div key={y} style={{position: "absolute", left: 30, top: y, width: 30, height: 30, borderRadius: "50%",
            background: "#17140F", boxShadow: "inset 0 3px 4px rgba(0,0,0,0.6)"}} />
        ))}
      </div>
      {/* the light pool: everything outside it falls off into the night (static, no blur) */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse ${POOL.rx}px ${POOL.ry}px at ${POOL.x}px ${POOL.y}px, `
        + "rgba(9,8,14,0) 0%, rgba(9,8,14,0) 56%, rgba(9,8,14,0.40) 80%, rgba(9,8,14,0.72) 100%)"}} />
      {/* the lamp's cone of light, very faint, from the shade towards the page */}
      <AbsoluteFill style={{background: "conic-gradient(from 128deg at 120px 96px, rgba(255,224,170,0) 0deg, "
        + "rgba(255,224,170,0.07) 10deg, rgba(255,224,170,0.07) 34deg, rgba(255,224,170,0) 44deg, rgba(255,224,170,0) 360deg)",
        maskImage: "radial-gradient(circle at 120px 96px, #000 0px, #000 500px, transparent 1300px)",
        WebkitMaskImage: "radial-gradient(circle at 120px 96px, #000 0px, #000 500px, transparent 1300px)"}} />
      <Lamp />
    </>
  );
};

/* ================================================================== kraft-board: an evidence board */

type Pt = {x: number; y: number};

const tornRect = (w: number, h: number, r: () => number, jag = 3.5) => {
  const pts: string[] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const u = i / n;
      pts.push(`${f1(x0 + (x1 - x0) * u + (r() - 0.5) * jag)} ${f1(y0 + (y1 - y0) * u + (r() - 0.5) * jag)}`);
    }
  };
  edge(0, 0, w, 0, 8);
  edge(w, 0, w, h, 6);
  edge(w, h, 0, h, 8);
  edge(0, h, 0, 0, 6);
  return "M" + pts.join(" L") + " Z";
};

const fibreStrands = (seed: number, n: number, minL: number, maxL: number) => {
  const r = rng(seed);
  let d = "";
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * 1200 + (r() < 0.25 ? 1560 : 0);
    const a = (r() - 0.5) * 0.9 + (r() < 0.5 ? 0 : Math.PI);
    const L = minL + r() * (maxL - minL);
    const bend = (r() - 0.5) * 16;
    const x2 = x + Math.cos(a) * L;
    const y2 = y + Math.sin(a) * L;
    d += `M${f1(x)} ${f1(y)} Q${f1((x + x2) / 2 + bend)} ${f1((y + y2) / 2 - bend)} ${f1(x2)} ${f1(y2)} `;
  }
  return d;
};

const kraftLayout = (seed: number) => {
  const r = rng(seed ^ 0x6b72);
  const j = (v: number, a: number) => v + (r() - 0.5) * 2 * a;
  const pins: Record<"A" | "B" | "C" | "D" | "E" | "F", Pt> = {
    A: {x: j(96, 10), y: j(214, 6)}, B: {x: j(990, 10), y: j(214, 6)},
    C: {x: j(44, 6), y: j(1010, 40)}, D: {x: j(1040, 4), y: j(1140, 30)},
    E: {x: j(168, 16), y: j(1676, 10)}, F: {x: j(772, 24), y: j(1708, 10)},
  };
  return {
    pins,
    rot: [j(-6, 2), j(5, 2), j(-4, 2), j(4, 2)],
    sag: [j(26, 10), j(24, 10), j(64, 18), j(26, 8)],
    paths: [tornRect(176, 126, r), tornRect(150, 132, r, 1.2), tornRect(118, 196, r, 2.5), tornRect(132, 128, r, 1.5)],
    tape: [tornRect(92, 30, r, 5), tornRect(84, 28, r, 5)],
    fibres: fibreStrands(seed ^ 0x99, 34, 26, 84),
    pale: fibreStrands(seed ^ 0x4d, 16, 20, 60),
    photoLeft: r() < 0.3,
  };
};

const sagPath = (a: Pt, b: Pt, sag: number) =>
  `M${f1(a.x)} ${f1(a.y)} Q${f1((a.x + b.x) / 2)} ${f1((a.y + b.y) / 2 + sag * 2)} ${f1(b.x)} ${f1(b.y)}`;

const PinHead: React.FC<{p: Pt; color: string}> = ({p, color}) => (
  <g>
    <ellipse cx={p.x + 5} cy={p.y + 7} rx={11} ry={8} fill="rgba(50,30,10,0.28)" />
    <circle cx={p.x} cy={p.y} r={11} fill={color} stroke="rgba(30,20,10,0.45)" strokeWidth={2} />
    <circle cx={p.x - 3.5} cy={p.y - 4} r={3.5} fill="rgba(255,255,255,0.65)" />
  </g>
);

export const KraftBoard: React.FC<{seed: number; category: CategoryName}> = ({seed, category}) => {
  const L = useMemo(() => kraftLayout(seed), [seed]);
  const cat = CATEGORIES[category];
  const {A, B, C, D, E, F} = L.pins;
  const twine = "#F1E8D4";
  const strings: {a: Pt; b: Pt; sag: number; color: string}[] = [
    {a: A, b: C, sag: L.sag[0], color: twine},
    {a: B, b: D, sag: L.sag[1], color: twine},
    {a: C, b: D, sag: L.sag[2], color: cat.fill}, // the one connection in the category colour
    {a: E, b: F, sag: L.sag[3], color: twine},
  ];
  const scrap = (i: number, x: number, y: number, children?: React.ReactNode, fill = "#FBF6EA") => (
    <g transform={`translate(${f1(x)} ${f1(y)}) rotate(${f1(L.rot[i])})`}>
      <path d={L.paths[i]} fill="rgba(60,38,12,0.20)" transform="translate(5 8)" />
      <path d={L.paths[i]} fill={fill} />
      {children}
    </g>
  );
  const scribble = (x: number, y: number, w: number, n: number, gap = 22) => (
    <g stroke="rgba(55,58,70,0.32)" strokeWidth={4} strokeLinecap="round">
      {Array.from({length: n}, (_, k) => (
        <path key={k} d={`M${x} ${y + k * gap} q${w * 0.25} -4 ${w * 0.5} 0 t${w * (k === n - 1 ? 0.2 : 0.5)} 0`}
          fill="none" />
      ))}
    </g>
  );
  const photoX = L.photoLeft ? A.x - 74 : B.x - 74;
  const noteX = L.photoLeft ? B.x - 88 : A.x - 88;
  return (
    <>
      {/* kraft fibres (two tones) and loose strands, calmed behind the caption band */}
      <AbsoluteFill style={{maskImage: CAPTION_CALM, WebkitMaskImage: CAPTION_CALM}}>
        <AbsoluteFill style={{backgroundImage: `url("${KRAFT_FIBRES}")`, backgroundSize: "360px 360px",
          mixBlendMode: "multiply", opacity: 0.55}} />
        <AbsoluteFill style={{backgroundImage: `url("${KRAFT_FLECKS}")`, backgroundSize: "280px 280px", opacity: 0.4}} />
        <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
          <path d={L.fibres} fill="none" stroke="rgba(112,76,32,0.22)" strokeWidth={1.6} strokeLinecap="round" />
          <path d={L.pale} fill="none" stroke="rgba(255,246,226,0.38)" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(90,58,20,0.20) 100%)"}} />
      <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
        {/* evidence scraps: a note and a photo up top (half under the header card), a receipt and a sticky note low */}
        {scrap(0, noteX, 194, scribble(26, 46, 120, 3))}
        {scrap(1, photoX, 186, (
          <g>
            <rect x={11} y={11} width={128} height={92} fill="#8D9FB0" />
            <rect x={11} y={11} width={128} height={46} fill="#A9B8C6" />
            <circle cx={75} cy={58} r={17} fill="#5D6E80" />
            <path d="M44 103 Q46 76 75 76 Q104 76 106 103 Z" fill="#5D6E80" />
          </g>
        ), "#FFFFFF")}
        {/* the low scraps sit under YouTube's own overlay: kept soft */}
        <g opacity={0.82}>
          {scrap(2, E.x - 58, E.y - 10, scribble(18, 40, 80, 6, 24), "#FAF7F0")}
          {scrap(3, F.x - 66, F.y - 14, scribble(22, 44, 86, 3, 26), cat.tint)}
        </g>
        {/* tape on the note and the receipt */}
        <g transform={`translate(${f1(noteX + 120)} 182) rotate(28)`}>
          <path d={L.tape[0]} fill="rgba(246,238,216,0.78)" />
        </g>
        <g transform={`translate(${f1(E.x - 42)} ${f1(E.y - 26)}) rotate(-8)`}>
          <path d={L.tape[1]} fill="rgba(246,238,216,0.78)" />
        </g>
        {/* strings: shadow first, then the twine (neutral) or the category colour */}
        {strings.map((s, k) => (
          <g key={k}>
            <path d={sagPath(s.a, s.b, s.sag)} fill="none" stroke="rgba(50,30,10,0.22)" strokeWidth={3.4}
              transform="translate(3 5)" />
            <path d={sagPath(s.a, s.b, s.sag)} fill="none" stroke={s.color} strokeWidth={3.4} strokeLinecap="round" />
          </g>
        ))}
        {[A, B, C, D, E, F].map((p, k) => <PinHead key={k} p={p} color={k === 3 ? cat.fill : "#D8D0C2"} />)}
      </svg>
    </>
  );
};

/* ================================================================== desk-spread: an open notebook on a desk */

const GUTTER = 1092; // page-local y of the binding (lands just above the caption band)

const Pen: React.FC = () => (
  <svg width={360} height={90} viewBox="0 0 360 90" style={{overflow: "visible"}}>
    <g transform="translate(10 12)">
      <path d="M18 34 L292 30 L332 36 L292 44 L18 44 Q6 39 18 34 Z" fill="rgba(20,30,45,0.22)" transform="translate(10 16)" />
      <rect x={14} y={22} width={270} height={22} rx={11} fill="#2D3A55" />
      <rect x={20} y={25} width={250} height={5} rx={2.5} fill="rgba(255,255,255,0.28)" />
      <rect x={214} y={22} width={56} height={22} fill="#1E2738" />
      <path d="M282 23 L322 31 Q328 33 322 35 L282 43 Z" fill="#C9CED6" />
      <path d="M318 30.5 L334 33 L318 35.5 Z" fill="#222" />
      <rect x={30} y={14} width={110} height={8} rx={4} fill="#B9C0CA" />
      <rect x={30} y={14} width={12} height={16} rx={4} fill="#B9C0CA" />
    </g>
  </svg>
);

const BinderClip: React.FC = () => (
  <svg width={130} height={120} viewBox="0 0 130 120" style={{overflow: "visible"}}>
    <path d="M38 52 L22 8 M92 52 L108 8" stroke="#AEB5BF" strokeWidth={6} strokeLinecap="round" fill="none" />
    <path d="M22 8 Q65 -6 108 8" stroke="#AEB5BF" strokeWidth={6} fill="none" strokeLinecap="round" />
    <path d="M14 56 L116 56 L106 98 L24 98 Z" fill="rgba(20,30,45,0.22)" transform="translate(4 8)" />
    <path d="M14 56 L116 56 L106 98 L24 98 Z" fill="#23272E" />
    <path d="M20 60 L110 60" stroke="rgba(255,255,255,0.22)" strokeWidth={3} />
  </svg>
);

export const DeskSpread: React.FC<{frame: number; seed: number; category: CategoryName}> = ({frame, seed, category}) => {
  const cat = CATEGORIES[category];
  const r = useMemo(() => rng(seed ^ 0x5d), [seed]);
  const phase = useMemo(() => r() * Math.PI * 2, [r]);
  // parallax: the spread is still; the clip and tabs drift a touch, the pen (nearest) a little more
  const drift = (amp: number, k: number) =>
    `translate(${f1(Math.sin(frame / 96 + phase + k) * amp)}px, ${f1(Math.cos(frame / 124 + phase + k) * amp * 0.6)}px)`;
  const tabs = [cat.tint, TONES.caution.tint, TONES.safe.tint];
  const tabEdge = [cat.fill, TONES.caution.fill, TONES.safe.fill];
  return (
    <>
      {/* desk mat: a fine weave and soft light from the top left */}
      <AbsoluteFill style={{backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 6px), "
        + "repeating-linear-gradient(90deg, rgba(20,30,45,0.035) 0px, rgba(20,30,45,0.035) 2px, transparent 2px, transparent 7px)"}} />
      <AbsoluteFill style={{background: "radial-gradient(ellipse 1100px 900px at 25% 10%, rgba(255,255,255,0.22), transparent 70%)"}} />
      {/* the open spread, tilted back a little (2.5D): top page above the binding, bottom page under the captions */}
      <AbsoluteFill style={{perspective: 2600, perspectiveOrigin: "50% 35%"}}>
        <div style={{position: "absolute", left: 40, top: 150, width: 1000, height: 1880,
          transform: "rotateX(8deg) rotateZ(-0.5deg)", transformOrigin: "50% 58%", transformStyle: "preserve-3d"}}>
          {/* page stack under the spread */}
          <div style={{position: "absolute", inset: "6px -6px -10px -6px", borderRadius: 14, background: "#DCD3C2",
            boxShadow: "0 34px 70px rgba(20,30,45,0.32), 0 8px 18px rgba(20,30,45,0.18)"}} />
          <div style={{position: "absolute", inset: "3px -3px -4px -3px", borderRadius: 12, background: "#EAE3D5"}} />
          {/* top page: dot grid, shading into the binding */}
          <div style={{position: "absolute", left: 0, top: 0, width: "100%", height: GUTTER, borderRadius: "12px 12px 4px 4px",
            background: "#F8F3E8", overflow: "hidden"}}>
            <div style={{position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(60,80,110,0.20) 2.2px, transparent 2.6px)",
              backgroundSize: "40px 40px", backgroundPosition: "20px 22px"}} />
            <div style={{position: "absolute", inset: 0, backgroundImage: `url("${PAPER_FIBRES}")`, backgroundSize: "300px 300px",
              mixBlendMode: "multiply", opacity: 0.28}} />
            <div style={{position: "absolute", left: 0, right: 0, bottom: 0, height: 120,
              background: "linear-gradient(180deg, rgba(80,66,40,0) 0%, rgba(80,66,40,0.16) 100%)"}} />
          </div>
          {/* bottom page: plain, calm under the captions */}
          <div style={{position: "absolute", left: 0, top: GUTTER, width: "100%", bottom: 0, borderRadius: "4px 4px 12px 12px",
            background: "#F6F1E5", overflow: "hidden"}}>
            <div style={{position: "absolute", inset: 0, backgroundImage: `url("${PAPER_FIBRES}")`, backgroundSize: "300px 300px",
              mixBlendMode: "multiply", opacity: 0.22}} />
            <div style={{position: "absolute", left: 0, right: 0, top: 0, height: 90,
              background: "linear-gradient(180deg, rgba(80,66,40,0.18) 0%, rgba(80,66,40,0) 100%)"}} />
          </div>
          <div style={{position: "absolute", left: 0, right: 0, top: GUTTER - 1, height: 3, background: "rgba(80,66,40,0.30)"}} />
          {/* index tabs sticking out of the right edge (far layer) */}
          {tabs.map((c, k) => (
            <div key={k} style={{position: "absolute", left: 988, top: 470 + k * 128, width: 44, height: 92,
              borderRadius: "0 12px 12px 0", background: c, borderRight: `5px solid ${tabEdge[k]}`,
              boxShadow: "2px 3px 6px rgba(20,30,45,0.18)", transform: drift(1.4, 0)}} />
          ))}
        </div>
      </AbsoluteFill>
      {/* binder clip on the top page's edge (mid layer) and the pen lying across the desk corner (near layer) */}
      <div style={{position: "absolute", left: 96, top: 82, transform: `${drift(2, 1)} rotate(-4deg)`}}>
        <BinderClip />
      </div>
      <div style={{position: "absolute", left: 830, top: 8, transform: `${drift(4.5, 2)} rotate(22deg)`,
        transformOrigin: "0 0"}}>
        <Pen />
      </div>
    </>
  );
};

/* ================================================================== mood-sky: a paper-cut sky that follows the tone */

export const SKY_TOP = 192;
export const HORIZON = 1004;

const cloudPath = (cx: number, cy: number, w: number) => {
  // a union of circles on a flat base (nonzero fill): one path per cloud
  const r = w / 4.4;
  const bumps: [number, number, number][] = [[-1.25, 0.25, 0.72], [-0.45, -0.35, 1], [0.45, -0.15, 0.86], [1.2, 0.3, 0.66]];
  // a flat, wide ellipse as the base, then the bumps (all counter-clockwise, so the union fills)
  const bx = w * 0.42;
  const by = r * 0.42;
  let d = `M${f1(cx - bx)} ${f1(cy + r * 0.3)} a${f1(bx)} ${f1(by)} 0 1 0 ${f1(2 * bx)} 0 `
    + `a${f1(bx)} ${f1(by)} 0 1 0 ${f1(-2 * bx)} 0 `;
  for (const [bx, by, br] of bumps) {
    const x = cx + bx * r;
    const y = cy + by * r;
    const R = br * r;
    d += `M${f1(x - R)} ${f1(y)} a${f1(R)} ${f1(R)} 0 1 0 ${f1(2 * R)} 0 a${f1(R)} ${f1(R)} 0 1 0 ${f1(-2 * R)} 0 `;
  }
  return d;
};

const skyLayout = (seed: number) => {
  const r = rng(seed ^ 0x5c7);
  let edge = `M-10 ${SKY_TOP}`;
  for (let x = 0; x <= W + 24; x += 24) edge += ` L${x} ${f1(SKY_TOP + (r() - 0.5) * 7)}`;
  const hillBack = `M-10 ${HORIZON - 40} Q180 ${HORIZON - 120} 380 ${HORIZON - 60} T760 ${HORIZON - 70} T1090 ${HORIZON - 96} L1090 ${HORIZON + 40} L-10 ${HORIZON + 40} Z`;
  const hillFront = `M-10 ${HORIZON - 6} Q260 ${HORIZON - 70} 560 ${HORIZON - 14} T1090 ${HORIZON - 30} L1090 ${HORIZON + 60} L-10 ${HORIZON + 60} Z`;
  const stars = [0, 1].map(() => {
    let d = "";
    for (let i = 0; i < 6; i++) {
      const x = 30 + r() * 1020;
      const y = SKY_TOP + 40 + r() * 620;
      const s = 6 + r() * 6;
      d += `M${f1(x)} ${f1(y - s)} Q${f1(x)} ${f1(y)} ${f1(x + s)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y + s)} `
        + `Q${f1(x)} ${f1(y)} ${f1(x - s)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y - s)} Z `;
    }
    return d;
  });
  const rain = Array.from({length: 18}, () => ({x: r() * 1140, y: r()}));
  // clouds sit where the sky stays visible around the content: one drifting along the band above the header card
  // (its top peeks over the card), the others swaying in the left / right margin columns
  const clouds = [
    {x: r() * 1500, y: SKY_TOP + 64, w: 290, drift: true},
    {x: 70 + r() * 20, y: 650 + r() * 40, w: 210, drift: false},
    {x: 1030 - r() * 20, y: 860 + r() * 30, w: 220, drift: false},
    {x: 96, y: 900 + r() * 20, w: 160, drift: false},
  ];
  return {edge: edge + ` L${W + 10} ${HORIZON} L-10 ${HORIZON} Z`, edgeLine: edge, hillBack, hillFront, stars, rain,
    clouds};
};

const HILL_BACK: Record<SkyState, string> = {night: "#3D4468", clouds: "#B5BDB4", day: "#B9D3A0"};

/** The celestial body sits in the right margin, visible beside the content in every layout. */
const SUN = {x: 1010, y: 650};

export const MoodSky: React.FC<{frame: number; seed: number; theme: Theme; from: SkyState; to: SkyState;
  mix: number}> = ({frame, seed, theme, from, to, mix}) => {
  const L = useMemo(() => skyLayout(seed), [seed]);
  const skies = theme.skies!;
  const op = (s: SkyState) => (s === to ? (from === to ? 1 : mix) : s === from ? 1 - mix : 0);
  const span = HORIZON - SKY_TOP;
  const cloudX = (c: {x: number; drift: boolean}, k: number) =>
    c.drift ? ((c.x + frame * 0.3) % 1500) - 210 : c.x + Math.sin(frame / 140 + k * 1.7) * 16;
  const drawSky = (s: SkyState) => {
    const o = op(s);
    if (o <= 0.001) return null;
    const [a, b, c] = skies[s].stops;
    return (
      <g key={s} opacity={o}>
        <rect x={0} y={SKY_TOP - 10} width={W} height={span + 20} fill={`url(#sky-${s})`} />
        {s === "night" ? (
          <>
            <path d={L.stars[0]} fill="#F6EFD9" opacity={0.55 + 0.35 * Math.sin(frame / 23)} />
            <path d={L.stars[1]} fill="#F6EFD9" opacity={0.55 + 0.35 * Math.sin(frame / 29 + 2)} />
            <circle cx={SUN.x} cy={SUN.y} r={44} fill="#F4E8C4" mask="url(#moonCut)" />
            <path d={cloudPath(SUN.x - 30, SUN.y + 36, 190)} fill="#3B4672" />
            <path d={L.rain.map((p) => {
              const y = SKY_TOP + (((p.y * span + frame * 21) % span) + span) % span;
              return `M${f1(p.x)} ${f1(y)} l-11 44`;
            }).join(" ")} stroke="rgba(204,218,244,0.5)" strokeWidth={3} strokeLinecap="round" mask="url(#rainClear)" />
          </>
        ) : null}
        {s === "clouds" ? L.clouds.map((c, k) => {
          const x = cloudX(c, k);
          return (
            <g key={k}>
              <path d={cloudPath(x, c.y + 8, c.w)} fill="rgba(70,84,104,0.16)" />
              <path d={cloudPath(x, c.y, c.w)} fill="#F6F4EF" />
            </g>
          );
        }) : null}
        {s === "day" ? (
          <>
            <g transform={`rotate(${f1(frame * 0.12)} ${SUN.x} ${SUN.y})`}>
              <path d={Array.from({length: 12}, (_, k) => {
                const ang = (k / 12) * Math.PI * 2;
                return `M${f1(SUN.x + Math.cos(ang) * 70)} ${f1(SUN.y + Math.sin(ang) * 70)} `
                  + `L${f1(SUN.x + Math.cos(ang) * 94)} ${f1(SUN.y + Math.sin(ang) * 94)}`;
              }).join(" ")} stroke="#F2B544" strokeWidth={7} strokeLinecap="round" />
            </g>
            <circle cx={SUN.x} cy={SUN.y} r={54} fill="#FFD66B" stroke="#F2B544" strokeWidth={5} />
            {L.clouds.slice(0, 2).map((c, k) => (
              <path key={k} d={cloudPath(cloudX(c, k), c.y + (k ? -40 : 0), c.w * 0.85)} fill="#FBFAF6" />
            ))}
          </>
        ) : null}
        {/* keep the gradient ids local to this state */}
        <defs>
          <linearGradient id={`sky-${s}`} gradientUnits="userSpaceOnUse" x1={0} y1={SKY_TOP} x2={0} y2={HORIZON}>
            <stop offset="0" stopColor={a} />
            <stop offset="0.55" stopColor={b} />
            <stop offset="1" stopColor={c} />
          </linearGradient>
        </defs>
      </g>
    );
  };
  const hill = interpolateColors(mix, [0, 1], [HILL_BACK[from], HILL_BACK[to]]);
  return (
    <>
      <svg width={W} height={H} style={{position: "absolute", inset: 0}}>
        <defs>
          <clipPath id="skyClip"><path d={L.edge} /></clipPath>
          {/* no rain over the handwritten tone label beside the card (soft-edged hole, no blur filter) */}
          <radialGradient id="rainHole">
            <stop offset="0.55" stopColor="#000" />
            <stop offset="1" stopColor="#fff" />
          </radialGradient>
          <mask id="rainClear" maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect x={0} y={0} width={W} height={H} fill="#fff" />
            <ellipse cx={835} cy={655} rx={190} ry={110} fill="url(#rainHole)" />
          </mask>
          <mask id="moonCut">
            <rect x={0} y={0} width={W} height={H} fill="#fff" />
            <circle cx={SUN.x - 20} cy={SUN.y - 12} r={40} fill="#000" />
          </mask>
        </defs>
        {/* the torn top edge casts a soft line on the page above it */}
        <path d={L.edgeLine} fill="none" stroke="rgba(70,50,20,0.16)" strokeWidth={6} transform="translate(0 4)" />
        <g clipPath="url(#skyClip)">{(["night", "clouds", "day"] as SkyState[]).map(drawSky)}</g>
        <path d={L.edgeLine} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
        {/* paper-cut hills: a back hill in the weather's colour, the page itself as the ground */}
        <path d={L.hillBack} fill={hill} />
        <path d={L.hillFront} fill="rgba(70,50,20,0.14)" transform="translate(0 -5)" />
        <path d={L.hillFront} fill={theme.baseStops[1]} />
      </svg>
      <PaperGrain tone={0.22} fibres={0.4} />
    </>
  );
};
