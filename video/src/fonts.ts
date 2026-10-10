import {loadFont} from "@remotion/fonts";
import {staticFile} from "remotion";

// Pretendard (SIL OFL 1.1): https://github.com/orioncactus/pretendard — no attribution required.
// Files are copied into public/fonts by scripts/prepare-assets.mjs.
export const FONT = "Pretendard";

// Gaegu Bold (SIL OFL 1.1, JIKJI SOFT): handwritten accents only (the self-writing notes on the paper stage),
// never captions, headlines or mockup text. File fetched by scripts/prepare-assets.mjs (sha256 checked).
// loadFont holds every frame (delayRender) until the face has loaded, so nothing renders in a fallback font.
export const HAND = "Gaegu";

for (const [weight, file] of [
  ["700", "Pretendard-Bold.otf"],
  ["800", "Pretendard-ExtraBold.otf"],
  ["900", "Pretendard-Black.otf"],
] as const) {
  loadFont({family: FONT, url: staticFile(`fonts/${file}`), weight});
}

loadFont({family: HAND, url: staticFile("fonts/Gaegu-Bold.ttf"), weight: "700"});
