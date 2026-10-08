import React from "react";
import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {Phone, PhoneOff} from "lucide-react";
import {ACCENTS, SceneProps} from "./types";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;

/**
 * Generic incoming-call screen for re-enactments. Deliberately not a copy of any real phone
 * maker's or carrier's UI: no logos, no brand fonts, a fictional layout.
 */
export const CallScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 14}});
  const exit = interpolate(frame, [durationInFrames - 7, durationInFrames], [1, 0], clamp);
  const buzzing = frame % 30 < 16;
  const shake = buzzing ? Math.sin(frame * 2.6) * 7 : 0;
  const caller = scene.caller ?? "알 수 없음";
  const accept = 1 + Math.sin(frame / 4) * 0.06;

  const rings = [0, 15, 30].map((offset) => {
    const p = ((frame + offset) % 45) / 45;
    return (
      <div key={offset} style={{position: "absolute", inset: 0, borderRadius: "50%",
        border: `5px solid ${ACCENTS.green}`, opacity: 0.55 * (1 - p), transform: `scale(${1 + p * 0.7})`}} />
    );
  });

  return (
    <div style={{position: "absolute", inset: 0, opacity: exit * enter}}>
      <div style={{position: "absolute", top: 300, width: "100%", textAlign: "center"}}>
        <div style={{fontSize: 40, fontWeight: 700, color: "rgba(214,224,240,0.8)"}}>{scene.callLabel ?? "수신 전화"}</div>
        <div style={{fontSize: 150, fontWeight: 900, letterSpacing: -3, marginTop: 6,
          textShadow: "0 10px 40px rgba(0,0,0,0.6)"}}>{caller}</div>
        <div style={{fontSize: 44, fontWeight: 700, color: "rgba(214,224,240,0.75)"}}>{scene.callerSub ?? "휴대전화"}</div>
      </div>
      {/* avatar with ripples, buzzing like a vibrating phone */}
      <div style={{position: "absolute", left: 540 - 140, top: 640, width: 280, height: 280,
        transform: `translateX(${shake}px)`}}>
        {rings}
        <div style={{position: "absolute", inset: 0, borderRadius: "50%",
          background: "linear-gradient(160deg, #2b3d63, #18233c)", border: "4px solid rgba(255,255,255,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 130, fontWeight: 900}}>
          {caller.slice(0, 1)}
        </div>
      </div>
      {/* answer / decline */}
      <div style={{position: "absolute", top: 1010, width: "100%", display: "flex", justifyContent: "center", gap: 300}}>
        {[{c: ACCENTS.red, I: PhoneOff, label: "거절", s: 1}, {c: ACCENTS.green, I: Phone, label: "수락", s: accept}].map(
          ({c, I, label, s}) => (
            <div key={label} style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 14}}>
              <div style={{width: 150, height: 150, borderRadius: "50%", background: c, display: "flex",
                alignItems: "center", justifyContent: "center", transform: `scale(${s})`,
                boxShadow: `0 0 40px ${c}88`}}>
                <I size={72} color="#fff" strokeWidth={2.4} />
              </div>
              <div style={{fontSize: 34, fontWeight: 700, color: "rgba(230,236,245,0.85)"}}>{label}</div>
            </div>
          ),
        )}
      </div>
    </div>
  );
};
