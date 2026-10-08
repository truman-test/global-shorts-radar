import {loadFont} from "@remotion/fonts";
import {staticFile} from "remotion";

// Pretendard (SIL OFL 1.1): https://github.com/orioncactus/pretendard — no attribution required.
// Files are copied into public/fonts by scripts/prepare-assets.mjs.
export const FONT = "Pretendard";

for (const [weight, file] of [
  ["700", "Pretendard-Bold.otf"],
  ["800", "Pretendard-ExtraBold.otf"],
  ["900", "Pretendard-Black.otf"],
] as const) {
  loadFont({family: FONT, url: staticFile(`fonts/${file}`), weight});
}
