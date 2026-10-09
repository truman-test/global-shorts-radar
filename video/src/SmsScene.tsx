import React from "react";
import {TriangleAlert, User} from "lucide-react";
import {interpolate, useCurrentFrame} from "remotion";
import {Avatar, clamp, PhonePanel, SceneHeader, SceneShell} from "./kit";
import {BRAND, muted, TONES, useTheme} from "./themes";
import {spr} from "./motion";
import {SMS_ARRIVE, SMS_FLAG} from "./schedule";
import {SceneProps} from "./types";

// Links reach us already masked by the Python validator ("http://●●●●.kr/…").
const LINK_RE = /((?:https?:\/\/)?●+[^\s]*)/;

/**
 * Invented text-message screen: one incoming message lands, then the (masked) link inside it is
 * boxed in red with a pulsing "의심 링크" tag pointing at it.
 */
export const SmsScene: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const red = TONES.danger.fill; // marks
  const pill = TONES.danger.solid; // white text on it: >= 7:1
  const text = scene.smsText ?? "";
  const [before, link, after] = (() => {
    const m = LINK_RE.exec(text);
    return m ? [text.slice(0, m.index), m[1], text.slice(m.index + m[1].length)] : [text, "", ""];
  })();
  const arrive = spr(frame, SMS_ARRIVE, 13, 0.03);
  const flag = spr(frame, SMS_FLAG, 12, 0.04);
  const pulse = frame >= SMS_FLAG ? (Math.sin((frame - SMS_FLAG) / 5) + 1) / 2 : 0;
  const mark = interpolate(frame, [SMS_FLAG - 6, SMS_FLAG + 4], [0, 1], clamp);

  return (
    <SceneShell>
      <SceneHeader scene={scene} />
      <PhonePanel header={
        <>
          <Avatar label="" color={`linear-gradient(160deg, ${t.avatar[0]}, ${t.avatar[1]})`}>
            <User size={38} color={muted(t, 0.85)} strokeWidth={2.4} />
          </Avatar>
          <div style={{display: "flex", flexDirection: "column", minWidth: 0}}>
            <div style={{fontSize: 40, fontWeight: 800, whiteSpace: "nowrap"}}>{scene.sender}</div>
            <div style={{fontSize: 26, fontWeight: 700, color: muted(t)}}>문자 메시지</div>
          </div>
        </>
      }>
        <div style={{flex: 1, display: "flex", flexDirection: "column", padding: "34px 34px 0", gap: 26}}>
          <div style={{alignSelf: "center", fontSize: 26, fontWeight: 700, color: muted(t), padding: "6px 20px",
            borderRadius: 999, background: "rgba(255,255,255,0.06)"}}>오늘 오후 2:14</div>
          <div style={{alignSelf: "flex-start", maxWidth: "86%", opacity: Math.min(1, arrive * 1.3),
            transform: `translateY(${(1 - arrive) * 30}px) scale(${0.85 + 0.15 * arrive})`, transformOrigin: "0% 100%"}}>
            <div style={{padding: "26px 32px 28px", borderRadius: 36, borderBottomLeftRadius: 10, background: t.bubble,
              fontSize: text.length > 70 ? 39 : 42, fontWeight: 700, lineHeight: 1.38, boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
              overflowWrap: "anywhere"}}>
              {before}
              {link ? (
                <span style={{position: "relative", display: "inline-block", color: mark > 0.5 ? BRAND.flaggedLink : "#9CC3FF",
                  textDecoration: "underline", textUnderlineOffset: 6, whiteSpace: "nowrap"}}>
                  <span style={{position: "absolute", left: -10, right: -10, top: -4, bottom: -4, borderRadius: 14,
                    border: `4px solid ${red}`, opacity: mark, background: `${red}${Math.round(20 + pulse * 30).toString(16)}`,
                    boxShadow: `0 0 ${10 + pulse * 26}px ${red}`}} />
                  <span style={{position: "relative"}}>{link}</span>
                </span>
              ) : null}
              {after}
            </div>
          </div>
          {link ? (
            <div style={{alignSelf: "flex-start", marginLeft: 40, display: "flex", flexDirection: "column",
              alignItems: "flex-start", opacity: Math.min(1, flag), transform: `translateY(${(1 - flag) * -16}px) scale(${
                (0.6 + 0.4 * flag) * (1 + pulse * 0.04)})`, transformOrigin: "20% 0%"}}>
              <div style={{marginLeft: 40, width: 0, height: 0, borderLeft: "16px solid transparent",
                borderRight: "16px solid transparent", borderBottom: `18px solid ${pill}`}} />
              <div style={{display: "flex", alignItems: "center", gap: 14, padding: "14px 28px", borderRadius: 999,
                background: pill, color: TONES.danger.onSolid, fontSize: 38, fontWeight: 900,
                boxShadow: `0 0 ${18 + pulse * 22}px ${red}aa`}}>
                <TriangleAlert size={40} color="#fff" strokeWidth={2.6} />
                의심 링크
              </div>
            </div>
          ) : null}
        </div>
      </PhonePanel>
    </SceneShell>
  );
};
