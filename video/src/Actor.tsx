// The cast's skin (script field cast_style, ShortProps.castStyle): the same rig, poses and stagings drawn as humans
// (Character.tsx) or as our animal cast (Animal.tsx). CastScene draws every character through `Character` here, so a
// staging never knows which skin is on. Only the legacy cast has a human design: any other registry character
// (content/characters) is drawn as its animal in both skins (script.py warns when a human-skin script casts one).
import React, {createContext, useContext} from "react";
import {AnimalCharacter} from "./Animal";
import {CharPose, Character as HumanCharacter} from "./Character";
import {hasHumanSkin, specOf} from "./registry";
import {CastStyle} from "./types";

export const CastStyleContext = createContext<CastStyle>("human");
export const useCastStyle = () => useContext(CastStyleContext);

export const Character: React.FC<{pose: CharPose; uid: string; box?: {w: number; h: number}; frame: number;
  style?: React.CSSProperties; skin?: CastStyle}> = ({skin, ...props}) => {
  const ctx = useCastStyle();
  const human = (skin ?? ctx) !== "animal" && hasHumanSkin(specOf(props.pose.id, props.pose.spec));
  return human ? <HumanCharacter {...props} /> : <AnimalCharacter {...props} />;
};
