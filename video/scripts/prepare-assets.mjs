// Copy licensed font files from node_modules into public/ (run after `npm install`).
// Pretendard is SIL OFL 1.1 (https://github.com/orioncactus/pretendard); the license travels with the files.
import {copyFileSync, mkdirSync} from "node:fs";

const out = "public/fonts";
mkdirSync(out, {recursive: true});
const base = "node_modules/pretendard/dist";
for (const f of ["Pretendard-Bold.otf", "Pretendard-ExtraBold.otf", "Pretendard-Black.otf"]) {
  copyFileSync(`${base}/public/static/${f}`, `${out}/${f}`);
}
copyFileSync(`${base}/LICENSE.txt`, `${out}/Pretendard-LICENSE.txt`);
console.log("fonts ready in public/fonts (Pretendard, SIL OFL 1.1)");
