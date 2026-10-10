// Procedural paper textures shared by the notebook stages (feTurbulence data URLs: no image assets, no network).
import React from "react";
import {AbsoluteFill} from "remotion";

export const W = 1080;
export const H = 1920;

const svgUrl = (svg: string) => "data:image/svg+xml;utf8," + encodeURIComponent(svg);

// fine fibres (dark specks, multiplied) and a slow blotchy tone
export const PAPER_FIBRES = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
  + "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' seed='3' stitchTiles='stitch'/>"
  + "<feColorMatrix values='0 0 0 0 0.42  0 0 0 0 0.36  0 0 0 0 0.26  0 0 0 -1.25 0.72'/></filter>"
  + "<rect width='300' height='300' filter='url(#n)'/></svg>");
export const PAPER_TONE = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920'>"
  + "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.004 0.006' numOctaves='3' seed='21'/>"
  + "<feColorMatrix values='0 0 0 0 0.78  0 0 0 0 0.68  0 0 0 0 0.50  0 0 0 -1.6 0.95'/></filter>"
  + "<rect width='1080' height='1920' filter='url(#n)'/></svg>");
// kraft: coarser, stretched fibres in two tones (dark strands and pale flecks)
export const KRAFT_FIBRES = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360'>"
  + "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9 0.16' numOctaves='3' seed='8' stitchTiles='stitch'/>"
  + "<feColorMatrix values='0 0 0 0 0.36  0 0 0 0 0.24  0 0 0 0 0.10  0 0 0 -1.5 0.82'/></filter>"
  + "<rect width='360' height='360' filter='url(#n)'/></svg>");
export const KRAFT_FLECKS = svgUrl(
  "<svg xmlns='http://www.w3.org/2000/svg' width='280' height='280'>"
  + "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='2' seed='17' stitchTiles='stitch'/>"
  + "<feColorMatrix values='0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.88  0 0 0 -2.2 1.1'/></filter>"
  + "<rect width='280' height='280' filter='url(#n)'/></svg>");

export const PaperGrain: React.FC<{tone?: number; fibres?: number}> = ({tone = 0.3, fibres = 0.45}) => (
  <>
    <AbsoluteFill style={{backgroundImage: `url("${PAPER_TONE}")`, backgroundSize: "1080px 1920px",
      mixBlendMode: "multiply", opacity: tone}} />
    <AbsoluteFill style={{backgroundImage: `url("${PAPER_FIBRES}")`, backgroundSize: "300px 300px",
      mixBlendMode: "multiply", opacity: fibres}} />
  </>
);

/** Deterministic PRNG (mulberry32): the same layout on every frame and every render. */
export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The pattern fades to a third behind the caption band (y ~1250-1560) so it never runs through the words.
export const CAPTION_CALM = "linear-gradient(180deg, #000 0px, #000 1170px, rgba(0,0,0,0.32) 1240px, "
  + "rgba(0,0,0,0.32) 1570px, #000 1650px)";
