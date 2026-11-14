// Liste des jeux officiels suivis pour le Master Living Dex.
// Les ids sont identiques à l'ancienne version Lovable pour rester compatibles
// avec une sauvegarde existante.
//
// dex :
//   { type: "range", max }            -> espèces nationales 1..max transférables dans le jeu
//   { type: "list", ids }             -> liste fixe
//   { type: "pokedex", match: [...] } -> Pokédex régionaux PokéAPI (union), repli = national complet

export const GEN_STYLES = {
  1: { label: "Gen 1", text: "text-red-400", bg: "bg-red-500", soft: "bg-red-500/15", border: "border-red-500/40", ring: "ring-red-500/60" },
  2: { label: "Gen 2", text: "text-amber-300", bg: "bg-amber-400", soft: "bg-amber-400/15", border: "border-amber-400/40", ring: "ring-amber-400/60" },
  3: { label: "Gen 3", text: "text-emerald-400", bg: "bg-emerald-500", soft: "bg-emerald-500/15", border: "border-emerald-500/40", ring: "ring-emerald-500/60" },
  4: { label: "Gen 4", text: "text-sky-400", bg: "bg-sky-500", soft: "bg-sky-500/15", border: "border-sky-500/40", ring: "ring-sky-500/60" },
  5: { label: "Gen 5", text: "text-slate-300", bg: "bg-slate-400", soft: "bg-slate-400/15", border: "border-slate-400/40", ring: "ring-slate-400/60" },
  6: { label: "Gen 6", text: "text-blue-400", bg: "bg-blue-500", soft: "bg-blue-500/15", border: "border-blue-500/40", ring: "ring-blue-500/60" },
  7: { label: "Gen 7", text: "text-orange-400", bg: "bg-orange-500", soft: "bg-orange-500/15", border: "border-orange-500/40", ring: "ring-orange-500/60" },
  8: { label: "Gen 8", text: "text-fuchsia-400", bg: "bg-fuchsia-500", soft: "bg-fuchsia-500/15", border: "border-fuchsia-500/40", ring: "ring-fuchsia-500/60" },
  9: { label: "Gen 9", text: "text-violet-400", bg: "bg-violet-500", soft: "bg-violet-500/15", border: "border-violet-500/40", ring: "ring-violet-500/60" },
};

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const GAMES = [
  { id: "yellow", name: "Jaune", short: "J", gen: 1, region: "Kanto", dex: { type: "range", max: 151 } },
  { id: "crystal", name: "Cristal", short: "C", gen: 2, region: "Johto", dex: { type: "range", max: 251 } },
  { id: "emerald", name: "Émeraude", short: "É", gen: 3, region: "Hoenn", dex: { type: "range", max: 386 } },
  { id: "firered", name: "Rouge Feu", short: "RF", gen: 3, region: "Kanto", dex: { type: "range", max: 386 } },
  { id: "heartgold", name: "HeartGold", short: "HG", gen: 4, region: "Johto", dex: { type: "range", max: 493 } },
  { id: "platinum", name: "Platine", short: "Pt", gen: 4, region: "Sinnoh", dex: { type: "range", max: 493 } },
  { id: "white2", name: "Blanc 2", short: "B2", gen: 5, region: "Unys", dex: { type: "range", max: 649 } },
  { id: "y", name: "Y", short: "Y", gen: 6, region: "Kalos", dex: { type: "range", max: 721 } },
  { id: "alphasapphire", name: "Saphir Alpha", short: "SA", gen: 6, region: "Hoenn", dex: { type: "range", max: 721 } },
  { id: "ultramoon", name: "Ultra-Lune", short: "UL", gen: 7, region: "Alola", dex: { type: "range", max: 807 } },
  { id: "letsgo", name: "Let's Go", short: "LG", gen: 7, region: "Kanto", dex: { type: "list", ids: [...range(1, 151), 808, 809] } },
  { id: "bdsp", name: "Diamant Étincelant", short: "DÉ", gen: 8, region: "Sinnoh", dex: { type: "range", max: 493 } },
  { id: "sword", name: "Épée", short: "Ép", gen: 8, region: "Galar", dex: { type: "pokedex", match: ["galar", "isle-of-armor", "crown-tundra"] } },
  { id: "legendsarceus", name: "Légendes Arceus", short: "LA", gen: 8, region: "Hisui", dex: { type: "pokedex", match: ["hisui"] } },
  { id: "violet", name: "Violet", short: "V", gen: 9, region: "Paldea", dex: { type: "pokedex", match: ["paldea", "kitakami", "blueberry"] } },
  { id: "legendsza", name: "Légendes Z-A", short: "ZA", gen: 9, region: "Illumis", dex: { type: "pokedex", match: ["lumiose", "hyperspace"], fuzzy: true } },
];

export const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));
export const genStyle = (gen) => GEN_STYLES[gen] ?? GEN_STYLES[1];

/**
 * Calcule la liste ordonnée des espèces disponibles dans un jeu.
 * Retourne { ids: number[], regional: Map<id, n°régional>|null, approx: boolean }
 */
export function computeGameDex(game, data) {
  const maxId = data.species.length;
  const d = game.dex;
  if (d.type === "range") return { ids: range(1, Math.min(d.max, maxId)), regional: null, approx: false };
  if (d.type === "list") return { ids: d.ids.filter((i) => i <= maxId), regional: null, approx: false };

  // pokedex : union des Pokédex régionaux, dans l'ordre (dex 1, puis ajouts du dex 2, ...)
  const names = Object.keys(data.dexes || {});
  const picked = [];
  for (const m of d.match) {
    for (const n of names) {
      const ok = d.fuzzy ? n.includes(m) : n === m;
      if (ok && !picked.includes(n)) picked.push(n);
    }
  }
  if (!picked.length) return { ids: range(1, maxId), regional: null, approx: true };
  const regional = new Map();
  const ids = [];
  let n = 0;
  for (const dexName of picked) {
    for (const sid of data.dexes[dexName]) {
      if (!regional.has(sid) && sid <= maxId) {
        n += 1;
        regional.set(sid, n);
        ids.push(sid);
      }
    }
  }
  return { ids, regional, approx: false, sources: picked };
}
