import { GAME_BY_ID } from "./games.js";

// Jeux officiels dont on peut lire la sauvegarde ou importer les fichiers, par génération de format.
export const OFFICIAL_BY_GEN = {
  1: ["yellow"], 2: ["crystal"], 3: ["emerald", "firered"], 4: ["heartgold", "platinum"], 5: ["white2"],
  6: ["y", "alphasapphire"], 7: ["ultramoon"], 8: ["sword", "bdsp"], 9: ["violet"],
};
export const OFFICIAL_BY_FORMAT = {
  pk1: ["yellow"], pk2: ["crystal"], pk3: ["emerald", "firered"], pk4: ["heartgold", "platinum"], pk5: ["white2"],
  pk6: ["y", "alphasapphire"], pk7: ["ultramoon"], pk8: ["sword"], pb8: ["bdsp"], pk9: ["violet"],
};
export const formatGen = (fmt) => Number(String(fmt ?? "").replace(/\D/g, "")) || null;
export const gameName = (id) => GAME_BY_ID[id]?.name ?? id;

/** Devine le jeu officiel d'une sauvegarde d'après la structure reconnue et le nom du fichier. */
export function guessOfficial(gen, label = "", fileName = "") {
  const list = OFFICIAL_BY_GEN[gen] ?? [];
  const hay = `${label} ${fileName}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const keys = { emerald: ["emeraude", "emerald"], firered: ["rouge feu", "firered", "fire red", "vert feuille", "leafgreen"], heartgold: ["heartgold", "soulsilver", "hgss", "coeur", "ame"], platinum: ["platine", "platinum", "diamant", "perle", "diamond", "pearl"], y: ["x / y", " xy", "pokemon y", "pokemon x"], alphasapphire: ["omega", "alpha", "oras", "rosa"] };
  for (const id of list) if ((keys[id] ?? []).some((k) => hay.includes(k))) return id;
  return list[0] ?? null;
}
