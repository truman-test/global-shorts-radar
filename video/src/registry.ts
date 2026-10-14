// The character registry (content/characters/<id>.json, schema in content/characters/README.md): every character the
// animal skin can draw is a data spec (species template, palette, age cues, outfit, prop), so a story can cast a new
// character without new code. Python (radar.production.characters) validates the files and puts the resolved spec of
// every cast member into the props (CastMember.spec); this bundle also carries the whole folder (webpack
// require.context, read at bundle time, no network) so plain props and the review lineup render by id alone.
// A spec in the props wins over the bundled file of the same id.
import COMP from "./composition.json";
import type {BodySpec} from "./Body";
import {CastMember, CharacterSpec, RoleKind} from "./types";

type Ctx = {keys(): string[]; (key: string): unknown};
// webpack's require.context (typed here; @types/node's `require` has no `context`)
const files = (require as unknown as {context: (dir: string, deep: boolean, re: RegExp) => Ctx})
  .context("../../content/characters", false, /\.json$/);

/** Every registry character by id (the folder at bundle time). */
export const REGISTRY: Record<string, CharacterSpec> = Object.fromEntries(
  files.keys().map((k) => files(k) as CharacterSpec).filter((s) => s && typeof s.id === "string").map((s) => [s.id, s]));

/** The ids in the registry, the legacy cast first (composition.json "characters"), then the rest by id. */
export const registryIds = (): string[] => {
  const legacy = (COMP.characters as string[]).filter((id) => REGISTRY[id]);
  return [...legacy, ...Object.keys(REGISTRY).filter((id) => !legacy.includes(id)).sort()];
};

/** The spec that draws a character: the one given (props), else the registry's, else the father (never blank). */
export const specOf = (id?: string, given?: CharacterSpec): CharacterSpec =>
  given ?? (id ? REGISTRY[id] : undefined) ?? REGISTRY.father;

/** The spec of a cast member (none = voice only). */
export const memberSpec = (m?: CastMember): CharacterSpec | undefined =>
  m?.character ? m.spec ?? REGISTRY[m.character] : undefined;

/** What the story uses a cast member for (registry role_kind): family (can be the victim), caller (the scam side:
 * call window, villain sets), other (a bystander / helper beside the victim), presenter (the TV ad voice). */
export const kindOf = (m?: CastMember): RoleKind | undefined => memberSpec(m)?.role_kind;

/** Only the 7 legacy characters have a human design (Character.tsx); a new registry character is always an animal. */
export const hasHumanSkin = (spec?: CharacterSpec) => Boolean(spec?.legacy && (COMP.characters as string[]).includes(spec.id));

type BodyClass = {waistY: number; hemY: number; crotch: number; sole: number} & Record<string, unknown>;
const CLASSES = COMP.bodyClasses as unknown as Record<string, BodyClass>;
const PINNED = COMP.bodies as Record<string, BodySpec>;

/** The SD body of a spec: a legacy pin (composition.json "bodies", kept pixel-identical), else its height class
 * (elder ~2.7 heads, adult ~2.9, tall ~3.0) and build (slim / regular / broad), a skirt when the outfit has one. */
export const bodyOfSpec = (spec: CharacterSpec): BodySpec => {
  if (spec.body.pin && PINNED[spec.body.pin]) return PINNED[spec.body.pin];
  const c = CLASSES[spec.body.height] ?? CLASSES.adult;
  const w = (c[spec.body.build] ?? c.regular) as {sh: number; w: number; waistW: number; hip: number; legX: number;
    legW: number};
  const B: BodySpec = {sh: w.sh, w: w.w, waistY: c.waistY, waistW: w.waistW, hemY: c.hemY, hip: w.hip,
    crotch: c.crotch, sole: c.sole, legX: w.legX, legW: w.legW};
  if (spec.outfit.skirt) B.skirt = [c.crotch + 138, Math.min(190, w.hip + 12)];
  return B;
};
