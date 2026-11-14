// Plateformes des ROM hacks gérées par la Banque.
// L'id "nds" reste la Gen 4 pour rester compatible avec les sauvegardes existantes.
export const PLATFORMS = {
  gb: { label: "GB · Gen 1", short: "GB", gen: 1, max: 151, cls: "bg-lime-500/15 text-lime-300", format: "pk1", base: "Rouge / Bleu / Jaune" },
  gbc: { label: "GBC · Gen 2", short: "GBC", gen: 2, max: 251, cls: "bg-amber-500/15 text-amber-300", format: "pk2", base: "Or / Argent / Cristal" },
  gba: { label: "GBA · Gen 3", short: "GBA", gen: 3, max: 386, cls: "bg-indigo-500/15 text-indigo-300", format: "pk3", base: "Rouge Feu / Émeraude" },
  nds: { label: "NDS · Gen 4", short: "NDS 4", gen: 4, max: 493, cls: "bg-sky-500/15 text-sky-300", format: "pk4", base: "DP / Platine / HGSS" },
  nds5: { label: "NDS · Gen 5", short: "NDS 5", gen: 5, max: 649, cls: "bg-rose-500/15 text-rose-300", format: "pk5", base: "Noir / Blanc / N2 / B2" },
  "3ds6": { label: "3DS · Gen 6", short: "3DS 6", gen: 6, max: 721, cls: "bg-blue-500/15 text-blue-300", format: "pk6", base: "X / Y / ROSA", official: true },
  "3ds7": { label: "3DS · Gen 7", short: "3DS 7", gen: 7, max: 807, cls: "bg-orange-500/15 text-orange-300", format: "pk7", base: "Soleil / Lune / USUL", official: true },
  sw8: { label: "Switch · Gen 8", short: "Switch 8", gen: 8, max: 905, cls: "bg-fuchsia-500/15 text-fuchsia-300", format: "pk8", base: "Épée / Bouclier / DÉ-PS", official: true },
  sw9: { label: "Switch · Gen 9", short: "Switch 9", gen: 9, max: 1025, cls: "bg-violet-500/15 text-violet-300", format: "pk9", base: "Écarlate / Violet", official: true },
};
/** Plateformes possibles pour un ROM hack (pas de hacks 3DS/Switch gérés). */
export const HACK_PLATFORM_IDS = ["gb", "gbc", "gba", "nds", "nds5"];
export const PLATFORM_IDS = Object.keys(PLATFORMS);
export const platformOf = (id) => PLATFORMS[id] ?? PLATFORMS.gba;
export const platformByGen = (gen) => PLATFORM_IDS.find((k) => PLATFORMS[k].gen === gen);
