import React from "react";
import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {Avatar, clamp, PhonePanel, SceneHeader, SceneShell} from "./kit";
import {muted, useTheme} from "./themes";
import {spr, useScene} from "./motion";
import {chatBeats, chatFollowsLines, chatMessages} from "./schedule";
import {SceneProps} from "./types";

const FONT_SIZE = 42;
const CHARS_PER_LINE = 14; // at 42px inside a bubble capped at 78% of the panel

/** Rough bubble height, only used to let the thread grow smoothly instead of jumping. */
const estHeight = (text: string) => Math.ceil(Math.max(1, text.length) / CHARS_PER_LINE) * 56 + 46;

const TypingDots: React.FC<{frame: number}> = ({frame}) => {
  const t = useTheme();
  return (
  <div style={{display: "flex", gap: 12, padding: "26px 30px", borderRadius: 34, borderBottomLeftRadius: 10,
    background: t.bubble}}>
    {[0, 1, 2].map((k) => {
      const y = Math.sin((frame - k * 4) / 3.2);
      return (
        <div key={k} style={{width: 16, height: 16, borderRadius: "50%", background: muted(t, 0.8),
          transform: `translateY(${Math.min(0, y) * 9}px)`, opacity: 0.5 + 0.5 * Math.max(0, -y)}} />
      );
    })}
  </div>
  );
};

/**
 * Invented messenger thread: bubbles arrive one by one over the narration (typing dots before
 * each incoming one), newest at the bottom, older ones scrolling up and fading under the header.
 */
export const ChatScene: React.FC<{scene: SceneProps; bare?: boolean}> = ({scene, bare}) => {
  const visual = useCurrentFrame();
  const t = useTheme();
  const {fps} = useVideoConfig();
  const ctx = useScene();
  const msgs = chatMessages(scene);
  const beats = chatBeats(scene, fps);
  const title = scene.chatTitle ?? "대화";
  // dialogue: bubbles land with the voices (speech time); the poster already shows the first one
  const speech = chatFollowsLines(scene);
  const lead = ctx.shift ?? 0;
  const frame = speech ? visual - lead : visual;

  const rows: React.ReactNode[] = [];
  msgs.forEach((m, k) => {
    const posterBubble = speech && ctx.first && k === 0;
    const {typingFrom, showAt} = posterBubble ? {typingFrom: null, showAt: -lead} : beats[k];
    const me = m.from === "me";
    if (typingFrom !== null && frame >= typingFrom && frame < showAt) {
      const t = spr(frame, typingFrom, 12);
      rows.push(
        <div key={`t${k}`} style={{alignSelf: "flex-start", flexShrink: 0, maxHeight: 90 * t, opacity: Math.min(1, t),
          transform: `scale(${0.7 + 0.3 * t})`, transformOrigin: "0% 100%"}}>
          <TypingDots frame={frame} />
        </div>,
      );
    }
    if (frame < showAt) return;
    const s = spr(frame, showAt, 12, 0.03);
    const grow = typingFrom !== null ? 1 : interpolate(s, [0, 0.6], [0, 1], clamp);
    rows.push(
      <div key={k} style={{alignSelf: me ? "flex-end" : "flex-start", maxWidth: "78%", flexShrink: 0,
        maxHeight: (estHeight(m.text) + 60) * grow, opacity: Math.min(1, s * 1.3),
        transform: `translateY(${(1 - s) * 24}px) scale(${0.82 + 0.18 * s})`,
        transformOrigin: me ? "100% 100%" : "0% 100%"}}>
        <div style={{padding: "20px 30px 22px", borderRadius: 34,
          [me ? "borderBottomRightRadius" : "borderBottomLeftRadius"]: 10,
          background: me ? t.bubbleMe : t.bubble, fontSize: FONT_SIZE, fontWeight: 700, lineHeight: 1.3,
          color: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.3)"}}>
          {m.text}
        </div>
      </div>,
    );
  });

  return (
    <SceneShell>
      {bare ? null : <SceneHeader scene={scene} />}
      <PhonePanel header={
        <>
          <Avatar label={title} />
          <div style={{display: "flex", flexDirection: "column"}}>
            <div style={{fontSize: 40, fontWeight: 800}}>{title}</div>
            <div style={{fontSize: 26, fontWeight: 700, color: muted(t)}}>메신저</div>
          </div>
        </>
      }>
        <div style={{flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 18,
          padding: "0 30px 34px", overflow: "hidden",
          maskImage: "linear-gradient(180deg, transparent 0px, #000 70px)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0px, #000 70px)"}}>
          {rows}
        </div>
      </PhonePanel>
    </SceneShell>
  );
};
