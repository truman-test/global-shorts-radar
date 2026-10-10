import React from "react";
import {interpolate, useCurrentFrame} from "remotion";
import {Grid3x3, MicOff, Phone, PhoneOff, Volume2} from "lucide-react";
import {clamp, TEXT, useBody, useShell} from "./kit";
import {Anchor, Face} from "./motion";
import {muted, useTheme} from "./themes";
import {sideLevel, useCast, useSpeechMs, Waveform} from "./dialogue";
import {SceneProps} from "./types";

export const CALL_AVATAR = 260;
export const CALL_AVATAR_TALK = 220; // the in-call screen of a dialogue leaves room for the "me" row and the buttons

// the phone screen the call sits in (dark on every stage, so it reads the same on paper)
const SCREEN = {top: 246, height: 990};
// dialogue: a little shorter, so the speaker chip above the captions (y 1190) has clear space under it
const TALK_SCREEN = {top: 246, height: 932};

/** Anchor size of a call scene (the shared element the traveller morphs to/from). */
export const callAvatar = (scene: SceneProps) => (scene.lines?.length ? CALL_AVATAR_TALK : CALL_AVATAR);

/**
 * Generic incoming-call screen for re-enactments, inside a phone screen panel. Deliberately not a copy of any
 * real phone maker's or carrier's UI: no logos, no brand fonts, a fictional layout. A plain call rings (ripples
 * around the avatar); a dialogue call (scene.lines) is connected and shows who is talking.
 */
export const CallScene: React.FC<{scene: SceneProps}> = ({scene}) =>
  scene.lines?.length ? <TalkingCall scene={scene} /> : <RingingCall scene={scene} />;

const RingingCall: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const shell = useShell("fade");
  const body = useBody();
  const buzzing = frame % 30 < 16;
  const shake = buzzing ? Math.sin(frame * 2.6) * 6 : 0;
  const caller = scene.caller ?? "알 수 없음";
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
      <div style={{position: "absolute", ...SCREEN, left: body.left, width: body.width, borderRadius: 64, background: t.panel, color: TEXT,
        border: "3px solid rgba(255,255,255,0.14)", boxShadow: "0 36px 90px rgba(0,0,0,0.45)", overflow: "hidden",
        transform: `translateX(${shake * 0.4}px)`}}>
        <div style={{position: "absolute", top: 62, width: "100%", textAlign: "center"}}>
          <div style={{fontSize: 38, fontWeight: 700, color: muted(t, 0.8)}}>{scene.callLabel ?? "수신 전화"}</div>
          <div style={{fontSize: nameSize, fontWeight: 900, letterSpacing: -2, lineHeight: 1.12, marginTop: 8,
            whiteSpace: "nowrap"}}>{caller}</div>
          <div style={{fontSize: 40, fontWeight: 700, color: muted(t, 0.75), marginTop: 4}}>{scene.callerSub ?? "휴대전화"}</div>
        </div>
        {/* avatar with ripples, buzzing like a vibrating phone */}
        <div style={{position: "absolute", left: (body.width - CALL_AVATAR) / 2, top: 400, width: CALL_AVATAR,
          height: CALL_AVATAR, transform: `translateX(${shake}px)`}}>
          {rings}
          <Anchor size={CALL_AVATAR} style={{position: "absolute", inset: 0}}>
            <Face look={{kind: "avatar", letter: caller.slice(0, 1)}} size={CALL_AVATAR} />
          </Anchor>
        </div>
        {/* answer / decline */}
        <AnswerButtons />
      </div>
    </div>
  );
};

const AnswerButtons: React.FC<{top?: number; opacity?: number}> = ({top = 760, opacity = 1}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const accept = 1 + Math.sin(frame / 4) * 0.06;
  return (
    <div style={{position: "absolute", top, width: "100%", display: "flex", justifyContent: "center", gap: 260, opacity}}>
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
  );
};

/** "mm:ss" call timer. */
const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Connected call for a dialogue scene: the caller at the top, "me" (the phone's owner, the victim) in a row below.
 * Whoever is talking gets a small waveform on their side and a soft halo; the other side stays still. A scene with
 * a lead-in rings first and connects when the first line starts.
 */
const TalkingCall: React.FC<{scene: SceneProps}> = ({scene}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const shell = useShell("fade");
  const body = useBody();
  const cast = useCast();
  const ms = useSpeechMs();
  const caller = scene.caller ?? "알 수 없음";
  const n = caller.replace(/\s/g, "").length;
  const nameSize = n <= 4 ? 116 : Math.max(76, Math.floor(620 / n));
  const them = sideLevel(scene, "them", ms);
  const me = sideLevel(scene, "me", ms);
  // ringing -> connected over ~8 frames just before the first line (instant when the scene has no lead-in)
  const connect = interpolate(ms, [scene.leadInMs - 320, scene.leadInMs - 60], [0, 1], clamp);
  const mine = Object.values(cast).find((c) => c.side === "me");
  const meLabel = mine?.label ?? "나";
  const callSeconds = 3 + Math.max(0, ms - scene.leadInMs) / 1000; // the call started a moment before we join
  const A = CALL_AVATAR_TALK;
  const green = t.accents.green;

  return (
    <div style={{position: "absolute", inset: 0, ...shell}}>
      <div style={{position: "absolute", ...TALK_SCREEN, left: body.left, width: body.width, borderRadius: 64,
        background: t.panel, color: TEXT, border: "3px solid rgba(255,255,255,0.14)",
        boxShadow: "0 36px 90px rgba(0,0,0,0.45)", overflow: "hidden"}}>
        {/* status + caller */}
        <div style={{position: "absolute", top: 46, width: "100%", textAlign: "center"}}>
          <div style={{fontSize: 34, fontWeight: 700, color: muted(t, 0.8), fontVariantNumeric: "tabular-nums"}}>
            {connect < 0.5 ? scene.callLabel ?? "수신 전화" : `통화 중  ${clock(callSeconds)}`}
          </div>
          <div style={{fontSize: nameSize, fontWeight: 900, letterSpacing: -2, lineHeight: 1.1, marginTop: 6,
            whiteSpace: "nowrap"}}>{caller}</div>
          <div style={{fontSize: 36, fontWeight: 700, color: muted(t, 0.75), marginTop: 2}}>{scene.callerSub ?? "휴대전화"}</div>
        </div>
        {/* the caller's avatar: a halo while they talk, the waveform under it */}
        <div style={{position: "absolute", left: (body.width - A) / 2, top: 300, width: A, height: A}}>
          {connect < 1 ? [0, 15, 30].map((offset) => {
            const p = ((frame + offset) % 45) / 45;
            return (
              <div key={offset} style={{position: "absolute", inset: 0, borderRadius: "50%",
                border: `5px solid ${green}`, opacity: 0.5 * (1 - p) * (1 - connect), transform: `scale(${1 + p * 0.5})`}} />
            );
          }) : null}
          <div style={{position: "absolute", inset: -14, borderRadius: "50%", border: `6px solid ${green}`,
            opacity: 0.75 * them, transform: `scale(${1 + 0.05 * them})`, boxShadow: `0 0 ${30 * them}px ${green}88`}} />
          <Anchor size={A} style={{position: "absolute", inset: 0}}>
            <Face look={{kind: "avatar", letter: caller.slice(0, 1)}} size={A} />
          </Anchor>
        </div>
        <div style={{position: "absolute", top: 548, width: "100%", display: "flex", justifyContent: "center",
          opacity: connect}}>
          <Waveform level={them} color={green} height={58} bars={9} width={10} />
        </div>
        {/* me: the phone's owner */}
        <div style={{position: "absolute", top: 640, left: 36, right: 36, height: 116, borderRadius: 30,
          background: `rgba(255,255,255,${0.05 + 0.05 * me})`, border: `3px solid ${me > 0.05 ? `${green}aa` : "rgba(255,255,255,0.08)"}`,
          display: "flex", alignItems: "center", gap: 20, padding: "0 26px", opacity: connect}}>
          <div style={{width: 70, height: 70, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 32, fontWeight: 900,
            background: `linear-gradient(160deg, ${t.avatar[0]}, ${t.avatar[1]})`, border: "2px solid rgba(255,255,255,0.22)"}}>
            나
          </div>
          <div style={{display: "flex", flexDirection: "column", minWidth: 0, flex: 1}}>
            <div style={{fontSize: 36, fontWeight: 800, whiteSpace: "nowrap"}}>{meLabel}</div>
            <div style={{fontSize: 26, fontWeight: 700, color: muted(t)}}>내 휴대전화</div>
          </div>
          <Waveform level={me} color={green} height={48} bars={6} width={9} seed={3} />
        </div>
        {/* generic in-call buttons; the answer/decline pair is shown while it still rings */}
        <div style={{position: "absolute", top: 790, width: "100%", display: "flex", justifyContent: "center",
          alignItems: "center", gap: 46, opacity: connect}}>
          {[MicOff, Grid3x3, Volume2].map((I, k) => (
            <div key={k} style={{width: 96, height: 96, borderRadius: "50%", background: "rgba(255,255,255,0.10)",
              display: "flex", alignItems: "center", justifyContent: "center"}}>
              <I size={44} color={muted(t, 0.9)} strokeWidth={2.2} />
            </div>
          ))}
          <div style={{width: 108, height: 108, borderRadius: "50%", background: t.accents.red, display: "flex",
            alignItems: "center", justifyContent: "center", boxShadow: `0 0 26px ${t.accents.red}66`}}>
            <PhoneOff size={50} color="#fff" strokeWidth={2.4} />
          </div>
        </div>
        {connect < 1 ? <AnswerButtons top={700} opacity={1 - connect} /> : null}
      </div>
    </div>
  );
};
