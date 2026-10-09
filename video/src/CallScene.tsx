import React from "react";
import {useCurrentFrame} from "remotion";
import {Phone, PhoneOff} from "lucide-react";
import {TEXT, useShell} from "./kit";
import {Anchor, Face} from "./motion";
import {muted, useTheme} from "./themes";
import {SceneProps} from "./types";

export const CALL_AVATAR = 260;

// the phone screen the call sits in (dark on every stage, so it reads the same on paper)
const SCREEN = {top: 246, height: 990, left: 110, width: 860};

/**
 * Generic incoming-call screen for re-enactments, inside a phone screen panel. Deliberately not a copy of any
 * real phone maker's or carrier's UI: no logos, no brand fonts, a fictional layout; the ripples are rings
 * around the avatar (never a waveform).
 */
export const CallScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const shell = useShell("fade");
  const buzzing = frame % 30 < 16;
  const shake = buzzing ? Math.sin(frame * 2.6) * 6 : 0;
  const caller = scene.caller ?? "알 수 없음";
  const accept = 1 + Math.sin(frame / 4) * 0.06;
  const n = caller.replace(/\s/g, "").length;
  const nameSize = n <= 4 ? 140 : Math.max(84, Math.floor(720 / n));

  const rings = [0, 15, 30].map((offset) => {
    const p = ((frame + offset) % 45) / 45;
    return (
      <div key={offset} style={{position: "absolute", inset: 0, borderRadius: "50%",
        border: `5px solid ${t.accents.green}`, opacity: 0.5 * (1 - p), transform: `scale(${1 + p * 0.6})`}} />
    );
  });

  return (
    <div style={{position: "absolute", inset: 0, ...shell}}>
      <div style={{position: "absolute", ...SCREEN, borderRadius: 64, background: t.panel, color: TEXT,
        border: "3px solid rgba(255,255,255,0.14)", boxShadow: "0 36px 90px rgba(0,0,0,0.45)", overflow: "hidden",
        transform: `translateX(${shake * 0.4}px)`}}>
        <div style={{position: "absolute", top: 62, width: "100%", textAlign: "center"}}>
          <div style={{fontSize: 38, fontWeight: 700, color: muted(t, 0.8)}}>{scene.callLabel ?? "수신 전화"}</div>
          <div style={{fontSize: nameSize, fontWeight: 900, letterSpacing: -2, lineHeight: 1.12, marginTop: 8,
            whiteSpace: "nowrap"}}>{caller}</div>
          <div style={{fontSize: 40, fontWeight: 700, color: muted(t, 0.75), marginTop: 4}}>{scene.callerSub ?? "휴대전화"}</div>
        </div>
        {/* avatar with ripples, buzzing like a vibrating phone */}
        <div style={{position: "absolute", left: (860 - CALL_AVATAR) / 2, top: 400, width: CALL_AVATAR,
          height: CALL_AVATAR, transform: `translateX(${shake}px)`}}>
          {rings}
          <Anchor size={CALL_AVATAR} style={{position: "absolute", inset: 0}}>
            <Face look={{kind: "avatar", letter: caller.slice(0, 1)}} size={CALL_AVATAR} />
          </Anchor>
        </div>
        {/* answer / decline */}
        <div style={{position: "absolute", top: 760, width: "100%", display: "flex", justifyContent: "center", gap: 260}}>
          {[{c: t.accents.red, I: PhoneOff, label: "거절", s: 1}, {c: t.accents.green, I: Phone, label: "수락", s: accept}].map(
            ({c, I, label, s}) => (
              <div key={label} style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 12}}>
                <div style={{width: 140, height: 140, borderRadius: "50%", background: c, display: "flex",
                  alignItems: "center", justifyContent: "center", transform: `scale(${s})`,
                  boxShadow: `0 0 36px ${c}77`}}>
                  <I size={66} color="#fff" strokeWidth={2.4} />
                </div>
                <div style={{fontSize: 32, fontWeight: 700, color: muted(t, 0.85)}}>{label}</div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
};
