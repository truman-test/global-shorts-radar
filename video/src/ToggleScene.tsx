import React from "react";
import {ChevronRight, Pointer} from "lucide-react";
import {interpolate, interpolateColors, useCurrentFrame, useVideoConfig} from "remotion";
import {HandCircle, rng, seedOf} from "./hand";
import {BODY_BOTTOM, BODY_TOP, clamp, PhonePanel, SceneHeader, SceneShell, TEXT} from "./kit";
import {spr} from "./motion";
import {TOGGLE_CIRCLE, toggleTaps} from "./schedule";
import {muted, TONES, useTheme, useTone} from "./themes";
import {SceneProps} from "./types";

const ROW_H = 104;
const CONTENT_H = BODY_BOTTOM - BODY_TOP - 112; // screen area under the panel header
const HEADER = 112; // PhonePanel header height
const PANEL_W = 860;
const SW = {w: 112, h: 62};

// Generic menu rows around the real path (no real OS's wording or icons).
const FILLER = ["알림", "화면", "소리와 진동", "배터리", "저장 공간", "언어와 입력", "계정", "연결"];
const FILLER_SWITCHES = ["자동 업데이트", "미리보기 표시", "기록 남기기", "빠른 실행"];

type Row = {label: string; target: boolean; on?: boolean};

/** The rows of screen k (0 = the settings home): the next path step (or the setting) plus seeded fillers. */
const screenRows = (path: string[], setting: string, from: boolean, k: number, seed: number): Row[] => {
  const r = rng(seed + k * 101);
  const final = k === path.length;
  const pool = (final ? FILLER_SWITCHES : FILLER).filter((f) => f !== (final ? setting : path[k]));
  const picks: string[] = [];
  while (picks.length < (final ? 2 : 3)) {
    const f = pool[Math.floor(r() * pool.length)];
    if (!picks.includes(f)) picks.push(f);
  }
  const rows: Row[] = picks.map((label) => ({label, target: false, on: final ? r() < 0.5 : undefined}));
  const at = final ? 1 : 1 + Math.floor(r() * 2);
  rows.splice(at, 0, {label: final ? setting : path[k], target: true, on: final ? from : undefined});
  return rows;
};

const Switch: React.FC<{on: number}> = ({on}) => {
  const bg = interpolateColors(on, [0, 1], ["#5A6170", TONES.safe.fill]);
  return (
    // our own switch: a squarish track and a rounded-square knob with an on/off tick (not a phone maker's pill)
    <div style={{position: "relative", width: SW.w, height: SW.h, borderRadius: 18, background: bg,
      boxShadow: "inset 0 2px 6px rgba(0,0,0,0.25)"}}>
      <div style={{position: "absolute", top: 7, left: 7 + (SW.w - SW.h) * on, width: SW.h - 14, height: SW.h - 14,
        borderRadius: 12, background: "#F7F8FA", boxShadow: "0 3px 8px rgba(0,0,0,0.3)", display: "flex",
        alignItems: "center", justifyContent: "center"}}>
        <div style={{width: on > 0.5 ? 18 : 16, height: on > 0.5 ? 10 : 4, borderLeft: on > 0.5 ? `5px solid ${TONES.safe.fill}` : "none",
          borderBottom: `5px solid ${on > 0.5 ? TONES.safe.fill : "#5A6170"}`, transform: on > 0.5 ? "rotate(-45deg) translateY(-2px)" : "none",
          boxSizing: "border-box"}} />
      </div>
    </div>
  );
};

/** Screen y of the centre of the setting's row on the final screen (the mascot points at it). */
export const toggleRowY = (scene: SceneProps) => {
  const path = scene.path ?? [];
  const rows = screenRows(path, scene.setting ?? "", scene.toggleTo === "off", path.length,
    seedOf((scene.setting ?? "") + path.join("/")));
  const i = rows.findIndex((r) => r.target);
  return BODY_TOP + HEADER + Math.round((CONTENT_H - rows.length * ROW_H) / 2) + i * ROW_H + ROW_H / 2;
};

/**
 * Settings flow inside an invented phone screen: a finger taps through the menu path (each screen slides in),
 * flips the switch, then the setting's row zooms a little and gets a hand-drawn circle.
 */
export const ToggleScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = useTheme();
  const tone = useTone(scene.accent);
  const path = scene.path ?? [];
  const setting = scene.setting ?? "";
  const to = scene.toggleTo !== "off";
  const taps = toggleTaps(scene, fps);
  const n = path.length;
  const seed = seedOf(setting + path.join("/"));
  const screens = Array.from({length: n + 1}, (_, k) => screenRows(path, setting, !to, k, seed));
  // screen k slides in after tap k-1
  const slide = (k: number) => (k === 0 ? 1 : Math.min(1, spr(frame, taps[k - 1] + 4, 12, 0)));
  const current = screens.reduce((c, _, k) => (k > 0 && frame >= taps[k - 1] + 4 ? k : c), 0);
  const title = (k: number) => (k === 0 ? "설정" : path[k - 1]);
  const flip = Math.min(1, spr(frame, taps[n], 8, 0));
  const zoom = spr(frame, taps[n] + TOGGLE_CIRCLE - 6, 14, 0.04);
  const circle = Math.min(1, spr(frame, taps[n] + TOGGLE_CIRCLE, 18, 0));
  // each list is centred in the screen area
  const listTop = (k: number) => Math.round((CONTENT_H - screens[k].length * ROW_H) / 2);
  const rowY = (k: number, i: number) => HEADER + listTop(k) + i * ROW_H; // panel coordinates
  const targetIndex = (k: number) => screens[k].findIndex((r) => r.target);

  // the finger: hovers near the bottom, glides to each target just before its tap, presses, lifts
  const targetPos = (k: number) => {
    const i = targetIndex(k);
    const y = rowY(k, i) + ROW_H / 2;
    return k === n ? {x: PANEL_W - 22 - 70 - SW.w / 2, y} : {x: 300, y};
  };
  let fx = 640;
  let fy = 620;
  taps.forEach((at, k) => {
    const p = spr(frame, at - 16, 13, 0.02);
    const tp = targetPos(k);
    fx += (tp.x - fx) * Math.min(1, p);
    fy += (tp.y - fy) * Math.min(1, p);
    // after the tap the finger lifts aside, so it never rests on a row of the next screen
    const lift = Math.min(1, spr(frame, at + 5, 10, 0));
    fx += 150 * lift;
    fy += 210 * lift;
  });
  const press = taps.reduce((m, at) => Math.max(m, frame >= at - 2 && frame < at + 6 ? 1 - Math.abs(frame - at - 1) / 5 : 0), 0);
  const fingerIn = Math.min(1, spr(frame, taps[0] - 22, 10, 0));
  const fingerOut = interpolate(frame, [taps[n] + 5, taps[n] + 11], [1, 0], clamp);
  const ripple = taps.map((at) => (frame >= at && frame < at + 16 ? (frame - at) / 16 : -1));

  const renderScreen = (k: number) => {
    const s = slide(k);
    const next = k < n ? slide(k + 1) : 0;
    const x = (1 - s) * PANEL_W - next * PANEL_W * 0.35;
    if (s <= 0 || next >= 0.97) return null;
    return (
      <div key={k} style={{position: "absolute", left: 0, top: HEADER, width: PANEL_W, bottom: 0,
        transform: `translateX(${x}px)`, opacity: Math.max(0, 1 - next * 1.4)}}>
        <div style={{position: "absolute", left: 0, right: 0, top: listTop(k)}}>
          {screens[k].map((row, i) => {
            const isSetting = k === n && row.target;
            const z = isSetting ? zoom : 0;
            return (
              <div key={i} style={{position: "relative", height: ROW_H, margin: "0 22px", padding: k === n ? "0 70px 0 22px" : "0 22px",
                display: "flex", alignItems: "center", gap: 20, borderRadius: 26,
                background: isSetting ? `rgba(255,255,255,${0.04 + 0.08 * Math.min(1, z)})` : "transparent",
                borderTop: i && !isSetting ? "2px solid rgba(255,255,255,0.06)" : "2px solid transparent",
                transform: `scale(${1 + 0.05 * Math.min(1.05, z)})`, transformOrigin: "50% 50%", zIndex: isSetting ? 2 : 1}}>
                <div style={{width: 18, height: 18, borderRadius: 6, background: row.target ? tone.fill : muted(t, 0.35)}} />
                <div style={{flex: 1, fontSize: 42, fontWeight: row.target ? 800 : 700,
                  color: row.target ? TEXT : muted(t, 0.8)}}>{row.label}</div>
                {k === n ? (
                  <div style={{position: "relative"}}>
                    <Switch on={row.target ? (to ? flip : 1 - flip) : row.on ? 1 : 0} />
                    {isSetting ? (
                      <HandCircle p={circle} color={tone.fill} seed={seed} w={SW.w} h={SW.h} pad={28}
                        width={7} />
                    ) : null}
                  </div>
                ) : (
                  <ChevronRight size={40} color={muted(t, 0.55)} strokeWidth={2.6} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <SceneShell>
      <SceneHeader scene={scene} />
      <PhonePanel top={BODY_TOP} bottom={BODY_BOTTOM} header={
        <div style={{display: "flex", flexDirection: "column"}}>
          <div style={{fontSize: 26, fontWeight: 700, color: muted(t)}}>
            {["설정", ...path.slice(0, Math.max(0, current - 1))].join(" › ")}{current > 0 ? " ›" : ""}
          </div>
          <div style={{fontSize: 40, fontWeight: 800}}>{title(current)}</div>
        </div>
      }>
        <div style={{position: "absolute", inset: 0, overflow: "hidden", borderRadius: 48}}>
          {screens.map((_, k) => renderScreen(k))}
          {/* the finger */}
          <div style={{position: "absolute", left: fx - 30, top: fy - 8, opacity: fingerIn * fingerOut,
            transform: `scale(${1 - 0.12 * press})`, transformOrigin: "30px 8px", zIndex: 5}}>
            {ripple.map((r, k) => (r >= 0 ? (
              <div key={k} style={{position: "absolute", left: 30 - 30 - r * 30, top: 8 - 30 - r * 30,
                width: 60 + r * 60, height: 60 + r * 60, borderRadius: "50%", border: "4px solid #fff",
                opacity: 0.7 * (1 - r)}} />
            ) : null))}
            <div style={{filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.45))"}}>
              <Pointer size={84} color="#1A1D24" fill="#FFFFFF" strokeWidth={1.6} />
            </div>
          </div>
        </div>
      </PhonePanel>
    </SceneShell>
  );
};
