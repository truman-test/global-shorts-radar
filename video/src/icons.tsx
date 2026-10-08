import React from "react";
import {
  AudioLines, Banknote, CircleCheckBig, Lock, Phone, RefreshCw, ShieldCheck, TriangleAlert, Users, Video,
} from "lucide-react";

// Lucide icons (ISC license): https://lucide.dev — no attribution required in the video.
// Names match radar.production.render.ICONS so the same scripts work with both engines.
const MAP: Record<string, React.ComponentType<{size?: number; color?: string; strokeWidth?: number}>> = {
  phone: Phone,
  voice: AudioLines,
  shield: ShieldCheck,
  lock: Lock,
  family: Users,
  warning: TriangleAlert,
  money: Banknote,
  check: CircleCheckBig,
  video: Video,
  update: RefreshCw,
};

export const Icon: React.FC<{name: string; size: number; color: string}> = ({name, size, color}) => {
  const C = MAP[name] ?? TriangleAlert;
  return <C size={size} color={color} strokeWidth={2.1} />;
};
