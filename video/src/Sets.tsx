// Drama sets: a wall tone, a floor tone and one or two props, nothing more (the face is the picture).
// Light (paper) stages: the room is a pencil sketch on the page (lines only, ~10% fills), so the stage stays visible
// and only the characters are fully coloured. Dark stages: the room is a dim warm tone with prop silhouettes, the
// characters carry a rim light. The scammer's call centre is always the dark alert tone (navy, teal monitor glow), so
// the two places contrast in colour temperature.
import React from "react";
import COMP from "./composition.json";
import {INK, shade} from "./Character";
import {FONT} from "./fonts";
import {SignText} from "./Handwriting";
import {VillainSet} from "./types";

export type SetMode = "light" | "dark";

const PENCIL = {stroke: INK, strokeWidth: 2.5, strokeOpacity: 0.32, fill: "none", strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const};

/** A sketchy line: drawn twice with a small offset, like a pencil going over it again. */
const Sk: React.FC<{d: string; fill?: string; fillOpacity?: number}> = ({d, fill, fillOpacity = 0.1}) => (
  <g>
    {fill ? <path d={d} fill={fill} fillOpacity={fillOpacity} stroke="none" /> : null}
    <path d={d} {...PENCIL} />
    <path d={d} {...PENCIL} strokeOpacity={0.14} transform="translate(2.5 1.5)" />
  </g>
);

export type HomeVariant = "living" | "sofa" | "work" | "shop";

/** Side-dish colours of the shop's tubs (kimchi, greens, braised, pickled radish, black beans, egg rolls). */
const BANCHAN = ["#D9534F", "#7FA36B", "#8A5A3C", "#F2C14E", "#4A4038", "#E9B949", "#B5452F"];
const BANCHAN_DIM = ["#6E3330", "#3F5236", "#4A3424", "#7A6230", "#2A2420", "#6E5A2C", "#5C2A20"];

/**
 * The family's side-dish shop (반찬가게, script set "shop"): two wall shelves of lidded tubs, a handwritten
 * "오늘의 반찬" sign, a glass-door fridge at the right. No brand, no prices. Light: the pencil sketch with ~20% fills
 * (only the tubs carry colour); dark: warm silhouettes and the fridge's cool glow.
 */
const ShopSet: React.FC<{mode: SetMode; w: number; h: number; floor: number}> = ({mode, w, h, floor}) => {
  const shelves = [570, 810];
  const tubs = (y: number, row: number) => Array.from({length: 6}, (_, i) => {
    const x = 24 + i * 124 + (row ? 46 : 0);
    const tall = (i + row) % 3 === 1;
    return {x, y, w: tall ? 84 : 104, h: tall ? 96 : 64, c: (i * 3 + row * 2) % BANCHAN.length, tall};
  }).filter((t) => t.x + t.w < 800);
  const all = shelves.flatMap((y, row) => tubs(y, row));
  const fridge = {x: 820, y: 420, w: 300, h: floor - 420};
  if (mode === "light") {
    return (
      <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0}}>
        <rect x={0} y={floor} width={w} height={h - floor} fill="#B89B74" opacity={0.12} />
        <Sk d={`M 0 ${floor} L ${w} ${floor}`} />
        <Sk d={`M 0 ${floor - 150} L ${fridge.x} ${floor - 150}`} />
        {/* the handwritten sign, taped to the wall */}
        <g transform="rotate(-4 165 440)">
          <Sk d="M 36 402 h 260 v 78 h -260 Z" fill="#FFF6D8" fillOpacity={0.55} />
          <SignText text="오늘의 반찬" x={166} y={456} size={46} fill={INK} opacity={0.62} />
        </g>
        {shelves.map((y) => (
          <g key={y}>
            <Sk d={`M 30 ${y} h 760 v 16 h -760 Z`} fill="#C9A98A" fillOpacity={0.18} />
            <Sk d={`M 80 ${y + 16} l 24 34 M 720 ${y + 16} l -24 34`} />
          </g>
        ))}
        {all.map((t, i) => (
          <g key={i}>
            <Sk d={`M ${t.x} ${t.y - t.h + 12} h ${t.w} v ${t.h - 14} q 0 2 -6 2 h ${-t.w + 12} q -6 0 -6 -2 Z`}
              fill={BANCHAN[t.c]} fillOpacity={0.5} />
            <Sk d={`M ${t.x - 6} ${t.y - t.h + 2} h ${t.w + 12} v 12 h ${-t.w - 12} Z`} fill="#FFFFFF" fillOpacity={0.4} />
          </g>
        ))}
        {/* the glass-door fridge */}
        <Sk d={`M ${fridge.x} ${fridge.y} h ${fridge.w} v ${fridge.h} h ${-fridge.w} Z`} fill="#CFE3EE" fillOpacity={0.4} />
        {[0.28, 0.5, 0.72].map((k) => <Sk key={k} d={`M ${fridge.x + 18} ${fridge.y + fridge.h * k} h ${fridge.w}`} />)}
        {[0.28, 0.5, 0.72].flatMap((k, row) => [0, 1].map((j) => (
          <Sk key={`${row}${j}`} d={`M ${fridge.x + 34 + j * 104} ${fridge.y + fridge.h * k - 52} h 80 v 50 h -80 Z`}
            fill={BANCHAN[(row * 2 + j + 1) % BANCHAN.length]} fillOpacity={0.45} />
        )))}
        <Sk d={`M ${fridge.x + 40} ${fridge.y + 40} l 90 140 M ${fridge.x + 70} ${fridge.y + 30} l 50 78`} />
      </svg>
    );
  }
  return (
    <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0}}>
      <defs>
        <linearGradient id="shopWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3A2E24" />
          <stop offset="100%" stopColor="#2A221D" />
        </linearGradient>
        <radialGradient id="shopFridge" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#CFE8FF" stopOpacity={0.32} />
          <stop offset="100%" stopColor="#CFE8FF" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="url(#shopWall)" opacity={0.94} />
      <rect x={0} y={floor} width={w} height={h - floor} fill="#17120F" opacity={0.9} />
      <g transform="rotate(-4 165 440)">
        <rect x={36} y={402} width={260} height={78} rx={6} fill="#5A4A38" />
        <SignText text="오늘의 반찬" x={166} y={456} size={46} fill="#F3E9C9" opacity={0.7} />
      </g>
      {shelves.map((y) => <rect key={y} x={30} y={y} width={760} height={16} fill="#1A1512" />)}
      {all.map((t, i) => (
        <g key={i}>
          <rect x={t.x} y={t.y - t.h + 12} width={t.w} height={t.h - 12} rx={8} fill={BANCHAN_DIM[t.c]} />
          <rect x={t.x - 6} y={t.y - t.h + 2} width={t.w + 12} height={12} rx={4} fill="#4A3B30" />
        </g>
      ))}
      <circle cx={fridge.x + fridge.w / 2} cy={fridge.y + fridge.h / 2} r={420} fill="url(#shopFridge)" />
      <rect x={fridge.x} y={fridge.y} width={fridge.w} height={fridge.h} rx={10} fill="#22303A" stroke="#3E5260"
        strokeWidth={6} />
      {[0.28, 0.5, 0.72].flatMap((k, row) => [0, 1].map((j) => (
        <rect key={`${row}${j}`} x={fridge.x + 34 + j * 104} y={fridge.y + fridge.h * k - 52} width={80} height={50} rx={6}
          fill={BANCHAN_DIM[(row * 2 + j + 1) % BANCHAN_DIM.length]} />
      )))}
      {[0.28, 0.5, 0.72].map((k) => <rect key={k} x={fridge.x + 10} y={fridge.y + fridge.h * k} width={fridge.w} height={5}
        fill="#5E7584" opacity={0.6} />)}
    </svg>
  );
};

/**
 * The victim's home (living: window + floor lamp; sofa: the TV corner's sofa back is drawn by the staging), the
 * family's side-dish shop (shop) or the other family member's workplace (work: blinds + a desk). `w`/`h` = the area
 * (full frame or a panel).
 */
export const HomeSet: React.FC<{mode: SetMode; variant?: HomeVariant; w?: number; h?: number; floor?: number;
  dim?: number}> = ({mode, variant = "living", w = 1080, h = 1920, floor = 1330, dim = 1}) => {
  if (variant === "shop") {
    return <div style={{position: "absolute", left: 0, top: 0, width: w, height: h, opacity: dim}}>
      <ShopSet mode={mode} w={w} h={h} floor={floor} /></div>;
  }
  const work = variant === "work";
  if (mode === "light") {
    return (
      <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0, opacity: dim}}>
        <rect x={0} y={floor} width={w} height={h - floor} fill="#B89B74" opacity={0.12} />
        <Sk d={`M 0 ${floor} L ${w} ${floor}`} />
        <Sk d={`M 0 ${floor - 150} L ${w} ${floor - 150}`} />
        {work ? (
          <g>
            <Sk d="M 70 300 h 420 v 420 h -420 Z" fill="#9CC3E6" />
            {Array.from({length: 9}, (_, i) => <Sk key={i} d={`M 78 ${330 + i * 44} h 404`} />)}
            <Sk d={`M 560 ${floor - 330} h 520 M 600 ${floor - 330} v 330`} fill="#B89B74" />
            <Sk d={`M 700 ${floor - 330} l 30 -150 h 220 l 30 150`} fill="#9CC3E6" />
            <Sk d={`M 980 ${floor - 330} c -10 -60 30 -120 60 -140 c -40 50 -30 100 -20 140`} fill="#7FA36B" />
          </g>
        ) : (
          <g>
            {/* window with curtains */}
            <Sk d="M 90 330 h 380 v 470 h -380 Z" fill="#9CC3E6" />
            <Sk d="M 280 330 v 470 M 90 565 h 380" />
            <Sk d="M 60 300 c 30 120 -10 360 20 540 h 60 c -20 -180 20 -400 -10 -540 Z" fill="#C9A98A" />
            <Sk d="M 500 300 c -30 120 10 360 -20 540 h -60 c 20 -180 -20 -400 10 -540 Z" fill="#C9A98A" />
            <Sk d="M 40 300 h 480" />
            {/* floor lamp in the right corner */}
            <Sk d={`M 920 ${floor + 10} v -560 M 860 ${floor + 10} h 120`} />
            <Sk d={`M 850 ${floor - 560} h 140 l -30 -110 h -80 Z`} fill="#F2C76B" fillOpacity={0.22} />
            <Sk d="M 640 760 h 170 v 130 h -170 Z" fill="#C9A98A" />
          </g>
        )}
      </svg>
    );
  }
  // dark: dim warm wall, darker floor, silhouettes, a warm lamp glow
  const wall = work ? "#1D2230" : "#2A221D";
  return (
    <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0, opacity: dim}}>
      <defs>
        <linearGradient id={`homeWall-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={work ? "#232A3A" : "#33281F"} />
          <stop offset="100%" stopColor={wall} />
        </linearGradient>
        <radialGradient id="homeLamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFC98A" stopOpacity={0.36} />
          <stop offset="100%" stopColor="#FFC98A" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill={`url(#homeWall-${variant})`} opacity={0.94} />
      <rect x={0} y={floor} width={w} height={h - floor} fill="#17120F" opacity={0.9} />
      <rect x={0} y={floor - 150} width={w} height={6} fill="#000" opacity={0.18} />
      {work ? (
        <g>
          <rect x={70} y={300} width={420} height={420} rx={8} fill="#2E3A55" />
          {Array.from({length: 9}, (_, i) => <rect key={i} x={70} y={318 + i * 44} width={420} height={14}
            fill="#20283A" />)}
          <rect x={560} y={floor - 330} width={520} height={26} fill="#151922" />
          <path d={`M 700 ${floor - 330} l 30 -150 h 220 l 30 150 Z`} fill="#20283A" />
          <path d={`M 730 ${floor - 470} h 220`} stroke="#5FD3C8" strokeOpacity={0.25} strokeWidth={6} />
        </g>
      ) : (
        <g>
          <rect x={90} y={330} width={380} height={470} rx={6} fill="#1A2442" />
          <circle cx={380} cy={420} r={34} fill="#F3E9C9" opacity={0.55} />
          {[[150, 400], [230, 470], [330, 650], [180, 700]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.5}
            fill="#F3E9C9" opacity={0.6} />)}
          <path d="M 280 330 v 470 M 90 565 h 380" stroke="#2A221D" strokeWidth={10} />
          <path d="M 60 300 c 30 120 -10 360 20 540 h 60 c -20 -180 20 -400 -10 -540 Z" fill="#3E3129" />
          <path d="M 500 300 c -30 120 10 360 -20 540 h -60 c 20 -180 -20 -400 10 -540 Z" fill="#3E3129" />
          <circle cx={920} cy={floor - 620} r={300} fill="url(#homeLamp)" />
          <rect x={914} y={floor - 560} width={12} height={570} fill="#1A1512" />
          <path d={`M 850 ${floor - 560} h 140 l -30 -110 h -80 Z`} fill="#8A6A45" />
          <rect x={640} y={760} width={170} height={130} rx={6} fill="#3A2E26" stroke="#4A3B30" strokeWidth={6} />
        </g>
      )}
    </svg>
  );
};

/**
 * The scammer's call centre: navy room, rows of partitions with distant teal monitors, the near monitor at the
 * right edge lighting the figure, a desk edge. `off`: the reveal, the monitor goes dark and the chair is empty.
 */
export const CallCentreSet: React.FC<{w: number; h: number; off?: boolean; frame: number}> = ({w, h, off, frame}) => {
  const flick = 0.92 + 0.08 * Math.sin(frame / 3.1) * Math.sin(frame / 7.3);
  const glow = off ? 0 : flick;
  return (
    <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0}}>
      <defs>
        <linearGradient id="ccWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0C1017" />
          <stop offset="100%" stopColor="#131925" />
        </linearGradient>
        <radialGradient id="ccMon" cx="1" cy="0.5" r="0.75">
          <stop offset="0%" stopColor="#5FD3C8" stopOpacity={0.42} />
          <stop offset="100%" stopColor="#5FD3C8" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#ccWall)" />
      {/* partitions and distant monitors */}
      {Array.from({length: 7}, (_, i) => (
        <g key={i}>
          <rect x={-20 + i * w * 0.17} y={h * 0.5} width={w * 0.15} height={h * 0.16} rx={6} fill="#171D28" />
          <rect x={-20 + i * w * 0.17} y={h * 0.5} width={w * 0.15} height={5} fill="#253042" />
          <rect x={-4 + i * w * 0.17} y={h * 0.43} width={w * 0.06} height={h * 0.05} rx={3} fill="#5FD3C8"
            opacity={0.18 + 0.1 * ((i * 7) % 3)} />
        </g>
      ))}
      <rect x={0} y={0} width={w} height={h} fill="url(#ccMon)" opacity={glow} />
      {/* the near monitor at the right edge */}
      <g transform={`translate(${w * 0.86} ${h * 0.5})`}>
        <rect x={0} y={-h * 0.08} width={w * 0.3} height={h * 0.26} rx={10} fill="#0B0E14" stroke="#05070A" strokeWidth={6} />
        <rect x={10} y={-h * 0.065} width={w * 0.28} height={h * 0.23} rx={6} fill={off ? "#141922" : "#5FD3C8"}
          opacity={off ? 1 : 0.85 * flick} />
      </g>
      {/* desk */}
      <rect x={0} y={h * 0.8} width={w} height={h * 0.2} fill="#1A202B" />
      <rect x={0} y={h * 0.8} width={w} height={5} fill="#2A3343" />
      <path d={`M ${w * 0.12} ${h * 0.86} l ${w * 0.16} -8 l 8 ${h * 0.05} l ${-w * 0.16} 8 Z`} fill="#CFC9BD" opacity={0.35} />
    </svg>
  );
};

/* ------------------------------------------------------------------ the caller's other rooms (villain_set) */

export type VillainSpec = {prop: PropKind; rim: string; light: string};
/** composition.json villainSets: per room its foreground prop, the caller's rim light and the key light's colour. */
export const VILLAIN = COMP.villainSets as Record<VillainSet, VillainSpec>;
export const villainOf = (v?: string): VillainSet => (v && v in VILLAIN ? v as VillainSet : "callcentre");

/** Positions as shares of the area, sizes by its width (the call window, the split panel and the full frame). */
const area = (w: number, h: number) => ({X: (f: number) => f * w, Y: (f: number) => f * h, S: w / 1080});

/**
 * A bland office at night (fake_office): a greige wall under a cold ceiling light, blinds with the street's light at
 * the left, a plain "상담실" plate (no logo, no company) and a filing cabinet at the right, a potted plant.
 */
const FakeOfficeSet: React.FC<{w: number; h: number; frame: number}> = ({w, h, frame}) => {
  const {X, Y, S} = area(w, h);
  const hum = 0.96 + 0.04 * Math.sin(frame / 2.3) * Math.sin(frame / 5.9);
  const slats = Array.from({length: 13}, (_, i) => Y(0.225) + i * 34 * S);
  return (
    <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0}}>
      <defs>
        <linearGradient id="foWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4C4B45" />
          <stop offset="100%" stopColor="#31302B" />
        </linearGradient>
        <radialGradient id="foLamp" cx="0.5" cy="0" r="0.8">
          <stop offset="0%" stopColor="#EAF2FA" stopOpacity={0.26} />
          <stop offset="100%" stopColor="#EAF2FA" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#foWall)" />
      <rect width={w} height={h * 0.6} fill="url(#foLamp)" opacity={hum} />
      {/* the wainscot and the floor */}
      <rect x={0} y={Y(0.62)} width={w} height={h * 0.38} fill="#2A2925" />
      <rect x={0} y={Y(0.62)} width={w} height={6 * S} fill="#5A5850" />
      {/* the blinds, the street's cold light between the slats */}
      <rect x={X(0.02)} y={Y(0.215)} width={250 * S} height={460 * S} rx={6 * S} fill="#1E2329" />
      {slats.map((y, i) => (
        <rect key={i} x={X(0.02) + 10 * S} y={y} width={230 * S} height={20 * S} rx={3 * S}
          fill={i % 4 === 1 ? "#B7C9DA" : "#8EA2B4"} opacity={0.8} />
      ))}
      <path d={`M ${X(0.02) + 200 * S} ${Y(0.215)} v ${450 * S}`} stroke="#1E2329" strokeWidth={5 * S} />
      {/* the potted plant */}
      <g transform={`translate(${X(0.12)} ${Y(0.6)}) scale(${S})`}>
        {[[-60, -150, -30], [0, -190, 0], [60, -150, 30], [-30, -120, -14], [34, -118, 16]].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx={30} ry={78} fill={i % 2 ? "#3F5A3C" : "#4E6B4A"}
            transform={`rotate(${r} ${x} ${y})`} />
        ))}
        <path d="M -70 -70 L 70 -70 L 54 30 L -54 30 Z" fill="#6B5A48" />
        <rect x={-78} y={-82} width={156} height={20} rx={6} fill="#7A6854" />
      </g>
      {/* the room plate: a plain sign, no logo, no company name */}
      <g transform={`translate(${X(0.795)} ${Y(0.24)}) scale(${S})`}>
        <rect x={0} y={0} width={210} height={92} rx={10} fill="#D9D4C7" stroke="#8C877C" strokeWidth={5} />
        <rect x={14} y={14} width={20} height={64} rx={4} fill="#7B8A8E" />
        <text x={122} y={62} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={44} fill="#3A3A36">
          상담실</text>
      </g>
      {/* the filing cabinet */}
      <g transform={`translate(${X(0.81)} ${Y(0.4)}) scale(${S})`}>
        <rect x={0} y={0} width={230} height={600} rx={8} fill="#5A5C58" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={14} y={14 + i * 146} width={202} height={130} rx={6} fill="#666964" />
            <rect x={90} y={64 + i * 146} width={52} height={14} rx={7} fill="#3B3D3A" />
          </g>
        ))}
      </g>
    </svg>
  );
};

/**
 * A fake finance studio (studio): deep indigo, two light columns at the left, warm beams from the ceiling, a big
 * screen at the right with a rising gold line over candle bars (no ticker, no channel mark), a glossy floor.
 */
const StudioSet: React.FC<{w: number; h: number; frame: number}> = ({w, h, frame}) => {
  const {X, Y, S} = area(w, h);
  const pulse = 0.85 + 0.15 * Math.sin(frame / 9);
  const scr = {x: X(0.76), y: Y(0.215), w: 300 * S, h: 470 * S};
  const candles = [0.18, 0.3, 0.42, 0.54, 0.66, 0.78];
  const line = candles.map((fx, i) => [scr.x + fx * scr.w, scr.y + scr.h * (0.82 - i * 0.13 + (i % 2) * 0.06)]);
  return (
    <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0}}>
      <defs>
        <linearGradient id="stWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#221C55" />
          <stop offset="100%" stopColor="#120F2E" />
        </linearGradient>
        <linearGradient id="stCol" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B88CFF" stopOpacity={0.75} />
          <stop offset="100%" stopColor="#FFC85A" stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="url(#stWall)" />
      {/* the warm beams from the ceiling */}
      <path d={`M ${X(0.3)} 0 L ${X(0.06)} ${Y(0.68)} L ${X(0.5)} ${Y(0.68)} Z`} fill="#FFD9A0" opacity={0.07} />
      <path d={`M ${X(0.72)} 0 L ${X(0.5)} ${Y(0.68)} L ${X(0.96)} ${Y(0.68)} Z`} fill="#FFD9A0" opacity={0.07} />
      {/* light columns */}
      {[0.02, 0.1].map((fx, i) => (
        <rect key={fx} x={X(fx)} y={Y(0.2)} width={46 * S} height={h * 0.46} rx={23 * S} fill="url(#stCol)"
          opacity={i ? 0.55 * pulse : 0.8 * pulse} />
      ))}
      {/* the chart screen */}
      <rect x={scr.x - 12 * S} y={scr.y - 12 * S} width={scr.w + 24 * S} height={scr.h + 24 * S} rx={14 * S} fill="#0B0A1C" />
      <rect x={scr.x} y={scr.y} width={scr.w} height={scr.h} rx={8 * S} fill="#16245A" />
      {[0.25, 0.5, 0.75].map((fy) => <path key={fy} d={`M ${scr.x} ${scr.y + fy * scr.h} h ${scr.w}`} stroke="#FFFFFF"
        strokeOpacity={0.12} strokeWidth={3 * S} />)}
      {candles.map((fx, i) => {
        const up = i % 3 !== 1;
        const top = scr.y + scr.h * (0.62 - i * 0.08);
        return <rect key={fx} x={scr.x + fx * scr.w - 10 * S} y={top} width={20 * S} height={scr.h * 0.16} rx={3 * S}
          fill={up ? "#3DDCB0" : "#8C93C8"} opacity={0.8} />;
      })}
      <path d={line.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ")} stroke="#F2C14E" strokeWidth={11 * S}
        fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M ${line[5][0]} ${line[5][1]} l ${-34 * S} ${4 * S} M ${line[5][0]} ${line[5][1]} l ${-4 * S} ${34 * S}`}
        stroke="#F2C14E" strokeWidth={11 * S} strokeLinecap="round" />
      {/* the glossy stage floor */}
      <rect x={0} y={Y(0.66)} width={w} height={h * 0.34} fill="#1D1846" />
      <rect x={0} y={Y(0.66)} width={w} height={5 * S} fill="#FFC85A" opacity={0.45} />
    </svg>
  );
};

/**
 * Inside a parked car at night (car), the camera on the dashboard: the roof lining, the rear window and the two side
 * windows with the street's lights out of focus, the pillars, the seat and its headrest behind the driver.
 */
const CarSet: React.FC<{w: number; h: number; frame: number}> = ({w, h, frame}) => {
  const {X, Y, S} = area(w, h);
  const bokeh: [number, number, number, string][] = [
    [0.05, 0.31, 40, "#F2B66B"], [0.14, 0.4, 26, "#BFD8FF"], [0.08, 0.5, 34, "#F2B66B"], [0.16, 0.27, 18, "#F2B66B"],
    [0.9, 0.3, 36, "#BFD8FF"], [0.97, 0.43, 28, "#F2B66B"], [0.86, 0.49, 22, "#F2B66B"], [0.94, 0.24, 18, "#BFD8FF"],
    [0.36, 0.25, 16, "#F2B66B"], [0.64, 0.24, 20, "#BFD8FF"]];
  // a passing car's light drifting along the rear window now and then
  const pass = ((frame % 150) / 150) * 1.4 - 0.2;
  return (
    <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0}}>
      <defs>
        <linearGradient id="carNight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B1222" />
          <stop offset="100%" stopColor="#1A2236" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="#0E1018" />
      {/* the windows: the rear one behind the head, a side window each side */}
      <path d={`M ${X(0.22)} ${Y(0.2)} L ${X(0.78)} ${Y(0.2)} L ${X(0.84)} ${Y(0.42)} L ${X(0.16)} ${Y(0.42)} Z`}
        fill="url(#carNight)" />
      <path d={`M 0 ${Y(0.2)} L ${X(0.17)} ${Y(0.2)} L ${X(0.12)} ${Y(0.56)} L 0 ${Y(0.58)} Z`} fill="url(#carNight)" />
      <path d={`M ${w} ${Y(0.2)} L ${X(0.83)} ${Y(0.2)} L ${X(0.88)} ${Y(0.56)} L ${w} ${Y(0.58)} Z`} fill="url(#carNight)" />
      {bokeh.map(([fx, fy, r, c], i) => (
        <circle key={i} cx={X(fx)} cy={Y(fy)} r={r * S} fill={c} opacity={0.32 + 0.18 * ((i * 7) % 3) / 2} />
      ))}
      <circle cx={X(pass)} cy={Y(0.33)} r={30 * S} fill="#FFF1D0" opacity={pass > 0.2 && pass < 0.8 ? 0.4 : 0} />
      {/* the roof lining and the pillars */}
      <rect x={0} y={0} width={w} height={Y(0.2)} fill="#2A2C33" />
      <path d={`M 0 ${Y(0.2)} H ${w}`} stroke="#3A3D46" strokeWidth={10 * S} />
      <path d={`M ${X(0.17)} ${Y(0.2)} L ${X(0.22)} ${Y(0.2)} L ${X(0.16)} ${Y(0.6)} L ${X(0.11)} ${Y(0.6)} Z`} fill="#24262D" />
      <path d={`M ${X(0.83)} ${Y(0.2)} L ${X(0.78)} ${Y(0.2)} L ${X(0.84)} ${Y(0.6)} L ${X(0.89)} ${Y(0.6)} Z`} fill="#24262D" />
      {/* the seat behind the driver: its back and the headrest */}
      <rect x={X(0.5) - 210 * S} y={Y(0.27)} width={420 * S} height={200 * S} rx={70 * S} fill="#3A332E" />
      <rect x={X(0.5) - 330 * S} y={Y(0.43)} width={660 * S} height={h} rx={150 * S} fill="#2E2925" />
      <path d={`M ${X(0.5) - 300 * S} ${Y(0.47)} q ${300 * S} ${-60 * S} ${600 * S} 0`} stroke="#3E3731"
        strokeWidth={8 * S} fill="none" />
      {/* the door panels below the windows */}
      <rect x={0} y={Y(0.58)} width={X(0.15)} height={h} fill="#1B1C22" />
      <rect x={X(0.85)} y={Y(0.58)} width={X(0.15) + 2} height={h} fill="#1B1C22" />
    </svg>
  );
};

/**
 * A small seminar stage (lecture_room): a warm wood wall, a slide screen at the left (an arrow, coins and bars, no
 * words), a plain roll-up banner at the right, a spotlight on the speaker.
 */
const LectureRoomSet: React.FC<{w: number; h: number; frame: number}> = ({w, h, frame}) => {
  const {X, Y, S} = area(w, h);
  const scr = {x: X(0.02), y: Y(0.215), w: 300 * S, h: 330 * S};
  const flick = 0.94 + 0.06 * Math.sin(frame / 4.7);
  return (
    <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0}}>
      <defs>
        <linearGradient id="lrWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#43322A" />
          <stop offset="100%" stopColor="#2A201B" />
        </linearGradient>
        <radialGradient id="lrSpot" cx="0.5" cy="0.36" r="0.5">
          <stop offset="0%" stopColor="#FFE0B0" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#FFE0B0" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#lrWall)" />
      {Array.from({length: 9}, (_, i) => <path key={i} d={`M ${X(0.06 + i * 0.11)} 0 V ${Y(0.66)}`} stroke="#000"
        strokeOpacity={0.14} strokeWidth={5 * S} />)}
      <rect width={w} height={h} fill="url(#lrSpot)" />
      {/* the slide screen: an up arrow over rising bars and coins, no words */}
      <rect x={scr.x - 10 * S} y={scr.y - 10 * S} width={scr.w + 20 * S} height={scr.h + 20 * S} rx={6 * S} fill="#1A1512" />
      <rect x={scr.x} y={scr.y} width={scr.w} height={scr.h} fill="#ECE6D8" opacity={flick} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={scr.x + (40 + i * 58) * S} y={scr.y + (250 - i * 50) * S}
        width={40 * S} height={(50 + i * 50) * S} fill={i === 3 ? "#E0A82E" : "#9AA9B8"} />)}
      <path d={`M ${scr.x + 40 * S} ${scr.y + 200 * S} L ${scr.x + 250 * S} ${scr.y + 60 * S}`} stroke="#3B9B6E"
        strokeWidth={14 * S} strokeLinecap="round" />
      <path d={`M ${scr.x + 250 * S} ${scr.y + 60 * S} l ${-52 * S} ${2 * S} M ${scr.x + 250 * S} ${scr.y + 60 * S}
        l ${-14 * S} ${48 * S}`} stroke="#3B9B6E" strokeWidth={14 * S} strokeLinecap="round" />
      {[[70, 70], [112, 54], [150, 76]].map(([x, y], i) => (
        <circle key={i} cx={scr.x + x * S} cy={scr.y + y * S} r={20 * S} fill="#F2C14E" stroke="#B8862A"
          strokeWidth={4 * S} />
      ))}
      {/* the roll-up banner: colour blocks only */}
      <g transform={`translate(${X(0.82)} ${Y(0.22)}) scale(${S})`}>
        <rect x={0} y={0} width={170} height={760} fill="#E8DCC4" />
        <rect x={0} y={0} width={170} height={150} fill="#2F4A6B" />
        <circle cx={85} cy={250} r={46} fill="#E0A82E" />
        {[360, 400, 440].map((y) => <rect key={y} x={22} y={y} width={126} height={18} rx={9} fill="#B9AE98" />)}
        <rect x={0} y={560} width={170} height={200} fill="#2F4A6B" opacity={0.85} />
        <rect x={-10} y={760} width={190} height={24} rx={8} fill="#1A1512" />
      </g>
      <rect x={0} y={Y(0.66)} width={w} height={h * 0.34} fill="#1E1713" />
    </svg>
  );
};

/** The caller's room of a scene (villain_set): the call centre by default. */
export const VillainSetView: React.FC<{set: VillainSet; w: number; h: number; frame: number; off?: boolean}> = ({set,
  w, h, frame, off}) => {
  switch (set) {
    case "fake_office": return <FakeOfficeSet w={w} h={h} frame={frame} />;
    case "studio": return <StudioSet w={w} h={h} frame={frame} />;
    case "car": return <CarSet w={w} h={h} frame={frame} />;
    case "lecture_room": return <LectureRoomSet w={w} h={h} frame={frame} />;
    default: return <CallCentreSet w={w} h={h} frame={frame} off={off} />;
  }
};

/** Radial focus lines (집중선) around a point, for the shock moments. */
export const FocusLines: React.FC<{cx: number; cy: number; color: string; opacity: number; seed?: number;
  w?: number; h?: number}> = ({cx, cy, color, opacity, seed = 3, w = 1080, h = 1920}) => (
  <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0, opacity, pointerEvents: "none"}}>
    {Array.from({length: 54}, (_, i) => {
      const a = (i / 54) * Math.PI * 2 + ((i * seed * 37) % 11) * 0.004;
      const r0 = 430 + ((i * 53) % 7) * 34;
      const r1 = 1500;
      const wd = 5 + ((i * 29) % 5) * 3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = -sa * wd;
      const ny = ca * wd;
      return <path key={i} d={`M ${cx + ca * r0} ${cy + sa * r0} L ${cx + ca * r1 + nx} ${cy + sa * r1 + ny}
        L ${cx + ca * r1 - nx} ${cy + sa * r1 - ny} Z`} fill={color} />;
    })}
  </svg>
);

export type PropKind = "table" | "desk" | "ccDesk" | "counter" | "officeDesk" | "anchorDesk" | "dashboard" | "lectern";

/** The callers' props (villain_set): always dark, whatever the stage. */
const CALLER_PROPS: Partial<Record<PropKind, {top: string; front: string; rim: string; line: string}>> = {
  ccDesk: {top: "#1E2531", front: "#141A24", rim: "#5FD3C8", line: "#05070A"},
  officeDesk: {top: "#4A4842", front: "#34322D", rim: "#DCE6EE", line: "#151411"},
  anchorDesk: {top: "#2E2766", front: "#1D1846", rim: "#FFD27A", line: "#0B0A1C"},
  dashboard: {top: "#1E2027", front: "#121318", rim: "#7FD0FF", line: "#05060A"},
  lectern: {top: "#8A6544", front: "#5E432E", rim: "#E9C79C", line: "#1A1512"},
};

/** The small prop on a surface (composition.json smallPropMaxTop): by the kind of surface. */
export type SmallProp = "cup" | "phoneStand" | "mail" | "none";
export const smallPropOf = (kind: PropKind): SmallProp =>
  kind === "ccDesk" || kind === "officeDesk" ? "phoneStand" : kind === "desk" ? "mail" : kind === "dashboard" ? "none" : "cup";
/** A surface whose edge sits lower than this (inside the caption band) carries no small prop. */
export const SMALL_PROP_MAX_TOP = COMP.smallPropMaxTop;
/** Where the small prop stands: at the left edge, clear of the captions' centred text and the right UI column. */
const SMALL_PROP_X = 66;

/**
 * One small generic prop standing on the surface at the left edge (its bottom on the edge `top`): a cup with a
 * handle (the home's table, the shop counter, the anchor desk, the lectern), a phone on a stand (the call centre and
 * office desks), two envelopes (the workplace desk). No brand, no text. Drawn in the surface's own tones with the ink
 * edge, ~90 px tall, so it dresses the lower frame without competing with the captions.
 */
const SmallPropView: React.FC<{kind: SmallProp; top: number; dark: boolean; line: string}> = ({kind, top, dark, line}) => {
  const st = {stroke: line, strokeWidth: 5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const};
  const x = SMALL_PROP_X;
  switch (kind) {
    case "cup": {
      const body = dark ? "#C9BFB0" : "#F6F1E7";
      const tea = dark ? "#6E4A2E" : "#B8814C";
      return (
        <g>
          <path d={`M ${x + 40} ${top - 62} q 26 2 26 22 q 0 22 -26 24`} fill="none" {...st} />
          <path d={`M ${x - 38} ${top - 80} h 78 l -8 80 h -62 Z`} fill={body} {...st} />
          <ellipse cx={x + 1} cy={top - 80} rx={39} ry={10} fill={tea} {...st} />
          <ellipse cx={x + 1} cy={top} rx={54} ry={8} fill="#000" opacity={0.12} />
        </g>
      );
    }
    case "phoneStand": {
      const shell = dark ? "#3A3F4B" : "#4A5160";
      return (
        <g>
          <ellipse cx={x} cy={top - 4} rx={40} ry={10} fill={dark ? "#2A2F3A" : "#5A6170"} {...st} />
          <g transform={`translate(${x} ${top - 8}) rotate(-14)`}>
            <rect x={-26} y={-96} width={52} height={92} rx={9} fill={shell} {...st} />
            <rect x={-19} y={-88} width={38} height={76} rx={5} fill={dark ? "#5FD3C8" : "#9FD8E8"} opacity={0.55} />
            <rect x={-19} y={-88} width={38} height={14} rx={5} fill="#FFFFFF" opacity={0.25} />
          </g>
        </g>
      );
    }
    case "mail": {
      const paper = dark ? "#D8D1C2" : "#F6F1E7";
      return (
        <g>
          <g transform={`translate(${x} ${top - 10}) rotate(-6)`}>
            <rect x={-46} y={-30} width={92} height={60} rx={4} fill={paper} {...st} />
            <path d="M -46 -30 L 0 2 L 46 -30" fill="none" {...st} strokeWidth={3.5} />
          </g>
          <g transform={`translate(${x + 6} ${top - 44}) rotate(4)`}>
            <rect x={-46} y={-30} width={92} height={60} rx={4} fill={paper} {...st} />
            <path d="M -46 -30 L 0 2 L 46 -30" fill="none" {...st} strokeWidth={3.5} />
            <rect x={22} y={-22} width={16} height={18} rx={2} fill="none" stroke={line} strokeWidth={3} opacity={0.6} />
          </g>
        </g>
      );
    }
    default:
      return null;
  }
};

/**
 * A foreground prop in front of the characters (composition.json "props"): its top edge at `top` (screen px), opaque
 * down to the frame's bottom, so a bust shot's body ends at a table / desk edge instead of running down the frame.
 * table = the home's table, desk = the office desk, ccDesk = the call centre's desk (always dark, a teal-lit edge).
 * The front face falls away under a floor gradient (darker toward the bottom: the room has a floor, not a flat
 * card, 2026-10-17 review) and, when the edge sits above SMALL_PROP_MAX_TOP, one small prop stands on it at the
 * left edge (SmallPropView). Nothing is drawn inside the caption band itself (the band is empty surface), so the
 * captions keep their contrast. Light stages: warm flat tones with an ink edge; dark stages: dim tones with a light rim.
 */
export const ForegroundProp: React.FC<{kind: PropKind; top: number; mode: SetMode; w?: number; h?: number;
  small?: boolean}> = ({kind, top, mode, w = 1080, h = 1920, small = true}) => {
  const caller = CALLER_PROPS[kind];
  const dark = mode === "dark" || Boolean(caller);
  const pal = caller ? caller
    // the shop counter: a steel top over a plain light front (no goods in the caption band)
    : kind === "counter" ? (dark ? {top: "#3A4048", front: "#2A2F36", rim: "#9AA6B2", line: "#101317"}
      : {top: "#E6EBEE", front: "#CBD5DA", rim: "#FFFFFF", line: INK})
    : kind === "desk" ? (dark ? {top: "#2A3242", front: "#1E2532", rim: "#8C9BB4", line: "#0E1118"}
      : {top: "#D9E0E8", front: "#B9C4D0", rim: "#FFFFFF", line: INK})
      : dark ? {top: "#4A3A2E", front: "#33281F", rim: "#7A6250", line: "#17120F"}
        : {top: "#E9D6B4", front: "#D3B88E", rim: "#FFF6E6", line: INK};
  const depth = 46;
  const edge = {stroke: pal.line, strokeWidth: 6, strokeLinejoin: "round" as const};
  const grad = `fg-${kind}-${Math.round(top)}-${mode}`;
  const prop = small && top <= SMALL_PROP_MAX_TOP ? smallPropOf(kind) : "none";
  return (
    <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0, pointerEvents: "none"}}>
      <defs>
        {/* the floor gradient: the front face darkens toward the floor (the bottom 20% sits under YouTube's UI) */}
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={pal.front} />
          <stop offset="55%" stopColor={shade(pal.front, 0.16)} />
          <stop offset="100%" stopColor={shade(pal.front, dark ? 0.5 : 0.34)} />
        </linearGradient>
      </defs>
      <rect x={-20} y={top + depth} width={w + 40} height={h - top} fill={`url(#${grad})`} />
      {prop !== "none" ? <SmallPropView kind={prop} top={top} dark={dark} line={pal.line} /> : null}
      <path d={`M -20 ${top} H ${w + 20} V ${top + depth} H -20 Z`} fill={pal.top} {...edge} />
      <path d={`M -20 ${top + depth} H ${w + 20}`} {...edge} />
      <path d={`M -20 ${top + 9} H ${w + 20}`} stroke={pal.rim} strokeWidth={4} opacity={caller ? 0.7 : 0.55} />
      {kind === "anchorDesk" ? (
        // the anchor desk's lit seam, low on the front (under the caption band)
        <path d={`M -20 ${Math.max(top + depth + 70, 1560)} H ${w + 20}`} stroke={pal.rim} strokeWidth={4} opacity={0.35} />
      ) : null}
      {kind === "dashboard" ? (
        // the dashboard's cool glow along its edge
        <rect x={-20} y={top + depth} width={w + 40} height={40} fill={pal.rim} opacity={0.1} />
      ) : null}
      {kind === "lectern" ? [0, 1].map((i) => (
        <path key={i} d={`M ${140 + i * 420} ${Math.max(top + depth + 60, 1560) + i * 40} q 180 -8 360 0`}
          stroke={pal.line} strokeWidth={3} opacity={0.22} fill="none" strokeLinecap="round" />
      )) : null}
      {/* a soft shadow the top casts down the front */}
      <rect x={-20} y={top + depth + 3} width={w + 40} height={26} fill="#000" opacity={0.08} />
      {kind === "counter" ? [180, 540, 900].map((x) => (
        // the counter's panel seams, low on the front (under the caption band)
        <path key={x} d={`M ${x} ${Math.max(top + depth + 70, 1540)} V ${h}`} stroke={pal.line} strokeWidth={3}
          opacity={0.18} />
      )) : null}
      {kind === "table" ? [0, 1].map((i) => (
        // two faint wood-grain strokes low on the front, under the caption band
        <path key={i} d={`M ${120 + i * 380} ${Math.max(top + depth + 60, 1560) + i * 46} q 160 -10 320 0`}
          stroke={pal.line} strokeWidth={3} opacity={0.16} fill="none" strokeLinecap="round" />
      )) : null}
    </svg>
  );
};
