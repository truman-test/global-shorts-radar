// The cast's skin (script field cast_style, ShortProps.castStyle): the same rig, poses and stagings drawn as humans
// (Character.tsx) or as our animal cast (Animal.tsx). CastScene draws every character through `Character` here, so a
// staging never knows which skin is on.
import React, {createContext, useContext} from "react";
import {AnimalCharacter} from "./Animal";
import {CharPose, Character as HumanCharacter} from "./Character";
import {CastStyle} from "./types";

export const CastStyleContext = createContext<CastStyle>("human");
export const useCastStyle = () => useContext(CastStyleContext);

export const Character: React.FC<{pose: CharPose; uid: string; box?: {w: number; h: number}; frame: number;
  style?: React.CSSProperties; skin?: CastStyle}> = ({skin, ...props}) => {
  const ctx = useCastStyle();
  return (skin ?? ctx) === "animal" ? <AnimalCharacter {...props} /> : <HumanCharacter {...props} />;
};
