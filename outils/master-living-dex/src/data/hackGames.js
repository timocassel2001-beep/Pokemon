import { platformOf } from "./platforms.js";

/** Chaque ROM hack devient un « jeu » suivi dans le Dex (hors objectifs du Master Living Dex officiel). */
export const hackGameId = (hackId) => `hack:${hackId}`;
export const isHackGameId = (gid) => typeof gid === "string" && gid.startsWith("hack:");

export function hackGames(hacks) {
  return (hacks ?? []).map((h) => {
    const P = platformOf(h.platform);
    return {
      id: hackGameId(h.id),
      hackId: h.id,
      name: h.name,
      short: h.name.slice(0, 3),
      gen: P.gen,
      region: `ROM hack · ${P.short}`,
      isHack: true,
      dex: { type: "range", max: h.dexMax ?? P.max },
    };
  });
}
