import React, {useLayoutEffect, useRef} from "react";
import {continueRender, delayRender, useCurrentFrame} from "remotion";
import {AnchorSpec, Face, spr} from "./motion";

/**
 * Continuity transition: scene N's shared element (icon chip, card badge or caller avatar) travels and
 * resizes into scene N+1's while the rest of both scenes crossfades. Both anchors are measured on screen
 * every frame (the header chip's position depends on the headline's width), so the hand-off at either
 * end is pixel exact. The two looks crossfade during the flight with a brief, light blur.
 *
 * Rendered inside a <Sequence from={boundary} durationInFrames={MORPH}>.
 */
export const Traveller: React.FC<{
  index: number; // boundary between scene `index` and `index + 1`
  from: AnchorSpec;
  to: AnchorSpec;
  hideFrom?: boolean; // the outgoing look stays hidden (a twist stamp covers it): only the incoming look flies out
}> = ({index, from, to, hideFrom}) => {
  const frame = useCurrentFrame();
  const box = useRef<HTMLDivElement>(null);
  const layerA = useRef<HTMLDivElement>(null);
  const layerB = useRef<HTMLDivElement>(null);
  // layered springs: the position leads, the size trails a little; both settle within MORPH frames
  const p = spr(frame, 0, 10, 0.015);
  const s = Math.min(1.01, spr(frame, 1, 9, 0.01));
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const opA = hideFrom ? 0 : 1 - clamp01((p - 0.3) / 0.4);
  const opB = clamp01(p / 0.4);
  const blur = (2.5 * Math.sin(Math.PI * clamp01(p))).toFixed(2);

  useLayoutEffect(() => {
    /** Position both layers between the two anchors; false while the layout is not final yet. */
    const place = (): boolean => {
      // not a ref from Short: on the first commit a parent's ref is attached after this effect runs
      const r = box.current?.closest("[data-scenes]");
      const ea = r?.querySelector(`[data-anchor="${index}"]`);
      const eb = r?.querySelector(`[data-anchor="${index + 1}"]`);
      if (!r || !ea || !eb || !layerA.current || !layerB.current) return false;
      const rr = r.getBoundingClientRect();
      if (rr.width < 1) return false; // a fresh render tab lays the canvas out at width 0 first
      const k = rr.width / 1080; // the Studio preview scales the canvas; renders are 1:1
      const centre = (e: Element) => {
        const b = e.getBoundingClientRect();
        return {x: (b.left + b.width / 2 - rr.left) / k, y: (b.top + b.height / 2 - rr.top) / k, d: b.width / k};
      };
      const a = centre(ea);
      const b = centre(eb);
      const x = a.x + (b.x - a.x) * p;
      const y = a.y + (b.y - a.y) * p;
      const d = Math.max(8, a.d + (b.d - a.d) * s);
      layerA.current.style.transform = `translate(${x - d / 2}px, ${y - d / 2}px) scale(${d / from.size})`;
      layerB.current.style.transform = `translate(${x - d / 2}px, ${y - d / 2}px) scale(${d / to.size})`;
      return true;
    };
    const fontsPending = document.fonts && document.fonts.status !== "loaded";
    if (place() && !fontsPending) return;
    // Hold the frame until the canvas has its real size and the web font has arrived (the header
    // chip's position depends on the headline's width), then measure again.
    const handle = delayRender("traveller: waiting for the final layout");
    let done = false;
    let sized = false;
    let fontsOk = !fontsPending;
    const finish = () => {
      if (!done) {
        done = true;
        continueRender(handle);
      }
    };
    const check = () => {
      sized = place() || sized;
      if (sized && fontsOk) finish();
    };
    const ro = new ResizeObserver(check);
    if (box.current) ro.observe(box.current);
    if (fontsPending) {
      document.fonts.ready.then(() => {
        fontsOk = true;
        check();
      });
    }
    return () => {
      ro.disconnect();
      finish();
    };
  });

  const layer: React.CSSProperties = {position: "absolute", left: 0, top: 0, transformOrigin: "0 0",
    filter: `blur(${blur}px)`};
  return (
    <div ref={box} style={{position: "absolute", inset: 0, pointerEvents: "none"}}>
      <div ref={layerB} style={{...layer, opacity: opB}}>
        <Face {...to} />
      </div>
      <div ref={layerA} style={{...layer, opacity: opA}}>
        <Face {...from} />
      </div>
    </div>
  );
};
