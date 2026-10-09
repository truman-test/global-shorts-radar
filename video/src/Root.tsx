import React from "react";
import {CalculateMetadataFunction, Composition} from "remotion";
import {Short} from "./Short";
import type {ShortProps} from "./types";

export const FPS = 30;

const sample: ShortProps = {
  channel: "디지털 생존노트",
  disclaimer: "※ 실제 수법을 바탕으로 한 재연입니다",
  sfx: false,
  scenes: [
    {
      layout: "call", audio: "", leadInMs: 900, speechMs: 3000, durationMs: 4200, headline: "엄마, 나 사고 났어", sub: "",
      icon: "phone", accent: "red", caller: "딸", callerSub: "휴대전화",
      pages: [{startMs: 900, endMs: 4000, words: [
        {text: "엄마,", startMs: 900, endMs: 1300}, {text: "나야.", startMs: 1300, endMs: 1800},
        {text: "사고가", startMs: 2100, endMs: 2600}, {text: "났어.", startMs: 2600, endMs: 3100}]}],
    },
    {
      layout: "card", audio: "", leadInMs: 0, speechMs: 3500, durationMs: 4000, headline: "그 목소리, 가짜일 수 있다",
      sub: "짧은 영상 몇 초면 복제", icon: "voice", accent: "red",
      pages: [{startMs: 0, endMs: 3800, words: [
        {text: "그런데", startMs: 0, endMs: 500}, {text: "이", startMs: 500, endMs: 700},
        {text: "목소리,", startMs: 700, endMs: 1300}, {text: "가짜일", startMs: 1500, endMs: 2100},
        {text: "수", startMs: 2100, endMs: 2300}, {text: "있습니다.", startMs: 2300, endMs: 3200}]}],
    },
  ],
};

const calculateMetadata: CalculateMetadataFunction<ShortProps> = ({props}) => ({
  durationInFrames: Math.max(FPS, Math.round((props.scenes.reduce((a, s) => a + s.durationMs, 0) / 1000) * FPS)
    + Math.round(((props.posterTailMs ?? 0) / 1000) * FPS)),
});

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Short"
    component={Short}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={FPS * 8}
    defaultProps={sample}
    calculateMetadata={calculateMetadata}
  />
);
