import React from "react";
import {interpolate, useCurrentFrame} from "remotion";
import {Icon} from "./icons";
import {BODY_TOP, clamp, SceneHeader, SceneShell, useBody} from "./kit";
import {spr} from "./motion";
import {ALERT_LAND} from "./schedule";
import {useTheme} from "./themes";
import {SceneProps} from "./types";


const BEZEL = 14;

/**
 * Close-up of an invented lock screen (generic clock, abstract wallpaper). A push banner slides in
 * from the top, the phone buzzes once and the screen behind the banner dims so the text reads first.
 * The phone runs off the bottom of the frame on purpose: captions sit over the dimmed glass.
 */
export const AlertScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const body = useBody();
  const PHONE_W = Math.min(820, body.width - 10);
  const accent = t.accents[scene.accent];
  const slide = spr(frame, ALERT_LAND - 8, 14);
  const dim = interpolate(frame, [ALERT_LAND - 4, ALERT_LAND + 8], [0, 0.62], clamp);
  const buzz = frame >= ALERT_LAND - 2 && frame < ALERT_LAND + 12 ? Math.sin(frame * 2.4) * 6 : 0;
  const glow = 0.5 + 0.5 * Math.sin(Math.max(0, frame - ALERT_LAND) / 7);

  return (
    <SceneShell>
      <SceneHeader scene={scene} />
      <div style={{position: "absolute", top: BODY_TOP + 10, left: body.left + (body.width - PHONE_W) / 2, width: PHONE_W, height: 1500,
        borderRadius: 86, background: "#0a0e18", border: "3px solid rgba(255,255,255,0.18)", padding: BEZEL,
        boxShadow: "0 40px 90px rgba(0,0,0,0.6)", transform: `translateX(${buzz}px)`}}>
        <div style={{position: "relative", width: "100%", height: "100%", borderRadius: 72, overflow: "hidden",
          background: t.wallpaper[0]}}>
          {/* abstract wallpaper */}
          <div style={{position: "absolute", width: 600, height: 600, left: -160, top: 260, borderRadius: "50%",
            background: t.wallpaper[1], opacity: 0.35, filter: "blur(90px)"}} />
          <div style={{position: "absolute", width: 520, height: 520, right: -180, top: 40, borderRadius: "50%",
            background: t.wallpaper[2], opacity: 0.28, filter: "blur(100px)"}} />
          {/* lock-screen clock (below the banner, so it stays readable as context) */}
          <div style={{position: "absolute", top: 400, width: "100%", textAlign: "center"}}>
            <div style={{fontSize: 34, fontWeight: 700, color: "rgba(255,255,255,0.85)"}}>오늘</div>
            <div style={{fontSize: 190, fontWeight: 800, letterSpacing: -4, lineHeight: 1.05, color: "rgba(255,255,255,0.95)"}}>
              2:14
            </div>
          </div>
          <div style={{position: "absolute", inset: 0, background: "#000", opacity: dim}} />
          {/* push banner */}
          <div style={{position: "absolute", top: 34, left: 22, right: 22, borderRadius: 40, padding: "26px 30px 30px",
            background: "#F4F6FB", color: "#131826",
            boxShadow: `0 20px 50px rgba(0,0,0,0.45), 0 0 ${30 + glow * 40}px ${accent}66`,
            transform: `translateY(${(1 - slide) * -380}px) scale(${0.94 + 0.06 * slide})`, opacity: Math.min(1, slide * 2)}}>
            <div style={{display: "flex", alignItems: "center", gap: 18}}>
              <div style={{width: 64, height: 64, borderRadius: 18, background: `linear-gradient(150deg, ${accent}, ${accent}aa)`,
                display: "flex", alignItems: "center", justifyContent: "center"}}>
                <Icon name={scene.icon} size={40} color="#fff" />
              </div>
              <div style={{flex: 1, fontSize: 32, fontWeight: 800, color: "#4a5368"}}>{scene.appLabel}</div>
              <div style={{fontSize: 28, fontWeight: 700, color: "#7a8396"}}>지금</div>
            </div>
            <div style={{marginTop: 18, fontSize: 42, fontWeight: 800, lineHeight: 1.36, letterSpacing: -0.5}}>
              {scene.alertText}
            </div>
          </div>
        </div>
      </div>
    </SceneShell>
  );
};
