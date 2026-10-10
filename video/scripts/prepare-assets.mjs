// Copy licensed font files from node_modules into public/ (run after `npm install`).
// Pretendard is SIL OFL 1.1 (https://github.com/orioncactus/pretendard); the license travels with the files.
import {copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {createHash} from "node:crypto";

const out = "public/fonts";
mkdirSync(out, {recursive: true});
const base = "node_modules/pretendard/dist";
for (const f of ["Pretendard-Bold.otf", "Pretendard-ExtraBold.otf", "Pretendard-Black.otf"]) {
  copyFileSync(`${base}/public/static/${f}`, `${out}/${f}`);
}
copyFileSync(`${base}/LICENSE.txt`, `${out}/Pretendard-LICENSE.txt`);
console.log("fonts ready in public/fonts (Pretendard, SIL OFL 1.1)");

// Gaegu Bold (SIL OFL 1.1, JIKJI SOFT) for handwritten accents; fetched from the official Google Fonts repo and
// checked against the hash recorded in assets/manifest.json.
const GAEGU = {
  url: "https://raw.githubusercontent.com/google/fonts/main/ofl/gaegu/Gaegu-Bold.ttf",
  license: "https://raw.githubusercontent.com/google/fonts/main/ofl/gaegu/OFL.txt",
  sha256: "cc38a4af9506a45254d1ce07c589ec473d9e5f0be319e5a77b17c214903f8c1c",
};
const gaegu = `${out}/Gaegu-Bold.ttf`;
if (!existsSync(gaegu)) {
  const buf = Buffer.from(await (await fetch(GAEGU.url)).arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex");
  if (hash !== GAEGU.sha256) throw new Error(`Gaegu-Bold.ttf hash mismatch: ${hash}`);
  writeFileSync(gaegu, buf);
  writeFileSync(`${out}/Gaegu-OFL.txt`, Buffer.from(await (await fetch(GAEGU.license)).arrayBuffer()));
}
const ok = createHash("sha256").update(readFileSync(gaegu)).digest("hex") === GAEGU.sha256;
console.log(`Gaegu Bold ${ok ? "ready" : "HASH MISMATCH"} (SIL OFL 1.1)`);
