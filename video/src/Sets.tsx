// Drama sets: a wall tone, a floor tone and one or two props, nothing more (the face is the picture).
// Light (paper) stages: the room is a pencil sketch on the page (lines only, ~10% fills), so the stage stays visible
// and only the characters are fully coloured. Dark stages: the room is a dim warm tone with prop silhouettes, the
// characters carry a rim light. The scammer's call centre is always the dark alert tone (navy, teal monitor glow), so
// the two places contrast in colour temperature.
import React from "react";
import {INK} from "./Character";

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

export type HomeVariant = "living" | "sofa" | "work";

/**
 * The victim's home (living: window + floor lamp; sofa: the TV corner's sofa back is drawn by the staging) or the
 * other family member's workplace (work: blinds + a desk). `w`/`h` = the area (full frame or a panel).
 */
export const HomeSet: React.FC<{mode: SetMode; variant?: HomeVariant; w?: number; h?: number; floor?: number;
  dim?: number}> = ({mode, variant = "living", w = 1080, h = 1920, floor = 1330, dim = 1}) => {
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

export type PropKind = "table" | "desk" | "ccDesk";

/**
 * A foreground prop in front of the characters (composition.json "props"): its top edge at `top` (screen px), opaque
 * down to the frame's bottom, so a bust shot's body ends at a table / desk edge instead of running down the frame.
 * table = the home's table, desk = the office desk, ccDesk = the call centre's desk (always dark, a teal-lit edge).
 * Plain surfaces only (no cups or keyboards): the edge sits in or near the caption band, nothing there may compete
 * with the captions. Light stages: warm flat tones with an ink edge; dark stages: dim tones with a light rim.
 */
export const ForegroundProp: React.FC<{kind: PropKind; top: number; mode: SetMode; w?: number; h?: number}> = ({kind,
  top, mode, w = 1080, h = 1920}) => {
  const dark = mode === "dark" || kind === "ccDesk";
  const pal = kind === "ccDesk" ? {top: "#1E2531", front: "#141A24", rim: "#5FD3C8", line: "#05070A"}
    : kind === "desk" ? (dark ? {top: "#2A3242", front: "#1E2532", rim: "#8C9BB4", line: "#0E1118"}
      : {top: "#D9E0E8", front: "#B9C4D0", rim: "#FFFFFF", line: INK})
      : dark ? {top: "#4A3A2E", front: "#33281F", rim: "#7A6250", line: "#17120F"}
        : {top: "#E9D6B4", front: "#D3B88E", rim: "#FFF6E6", line: INK};
  const depth = 46;
  const edge = {stroke: pal.line, strokeWidth: 6, strokeLinejoin: "round" as const};
  return (
    <svg width={w} height={h} style={{position: "absolute", left: 0, top: 0, pointerEvents: "none"}}>
      <rect x={-20} y={top + depth} width={w + 40} height={h - top} fill={pal.front} />
      <path d={`M -20 ${top} H ${w + 20} V ${top + depth} H -20 Z`} fill={pal.top} {...edge} />
      <path d={`M -20 ${top + depth} H ${w + 20}`} {...edge} />
      <path d={`M -20 ${top + 9} H ${w + 20}`} stroke={pal.rim} strokeWidth={4} opacity={kind === "ccDesk" ? 0.7 : 0.55} />
      {/* a soft shadow the top casts down the front */}
      <rect x={-20} y={top + depth + 3} width={w + 40} height={26} fill="#000" opacity={0.08} />
      {kind === "table" ? [0, 1].map((i) => (
        // two faint wood-grain strokes low on the front, under the caption band
        <path key={i} d={`M ${120 + i * 380} ${Math.max(top + depth + 60, 1560) + i * 46} q 160 -10 320 0`}
          stroke={pal.line} strokeWidth={3} opacity={0.16} fill="none" strokeLinecap="round" />
      )) : null}
    </svg>
  );
};

