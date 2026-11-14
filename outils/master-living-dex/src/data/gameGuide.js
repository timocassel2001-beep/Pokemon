// Guide des jeux officiels : méthodes d'évolution valables dans chaque jeu, Pokémon trouvables sur place
// et Pokémon à faire venir d'un autre jeu (transfert officiel).
//
// Source : CSV officiels de la PokéAPI. Dans pokemon_evolution.csv, chaque méthode est rattachée au groupe
// de versions où elle apparaît (version_group_id) : elle reste valable dans les jeux suivants, sauf :
//  - les mécaniques qui disparaissent (Beauté : Gen 3-5, ROSA, DÉPS ; Affection : Gen 6-7, devenue Amitié ensuite),
//  - les lieux et régions propres à une région (Mont Couronné, Rocher Mousse…),
//  - les jeux « à part » (Let's Go, Légendes Arceus, Légendes Z-A) dont les méthodes ne valent que chez eux,
//  - une méthode plus récente du même type remplace l'ancienne.

import { parseCSV } from "./pokedata.js";
import { OFFICIAL_META, evaluateTransfer } from "../lib/officialTransfer.js";

const CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
const CACHE_KEY = "mld-guide-v2";
const FR = "5", EN = "9";

export const GAME_INFO = {
  yellow: { versions: ["yellow"], vgs: ["yellow"], regions: [1], gen: 1, breeding: false, dexes: ["kanto"] },
  crystal: { versions: ["crystal"], vgs: ["crystal"], regions: [2, 1], gen: 2, breeding: true, dexes: ["original-johto"] },
  emerald: { versions: ["emerald"], vgs: ["emerald"], regions: [3], gen: 3, breeding: true, dexes: ["hoenn"], beauty: true },
  firered: { versions: ["firered"], vgs: ["firered-leafgreen"], regions: [1], gen: 3, breeding: true, dexes: ["kanto"] },
  heartgold: { versions: ["heartgold"], vgs: ["heartgold-soulsilver"], regions: [2, 1], gen: 4, breeding: true, dexes: ["updated-johto"] },
  platinum: { versions: ["platinum"], vgs: ["platinum"], regions: [4], gen: 4, breeding: true, dexes: ["extended-sinnoh"], beauty: true },
  white2: { versions: ["white-2"], vgs: ["black-2-white-2"], regions: [5], gen: 5, breeding: true, dexes: ["updated-unova"], beauty: true },
  y: { versions: ["y"], vgs: ["x-y"], regions: [6], gen: 6, breeding: true, dexes: ["kalos-central", "kalos-coastal", "kalos-mountain"], affection: true },
  alphasapphire: { versions: ["alpha-sapphire"], vgs: ["omega-ruby-alpha-sapphire"], regions: [3], gen: 6, breeding: true, dexes: ["updated-hoenn"], affection: true, beauty: true },
  ultramoon: { versions: ["ultra-moon"], vgs: ["ultra-sun-ultra-moon"], regions: [7], gen: 7, breeding: true, dexes: ["updated-alola"], affection: true },
  letsgo: { versions: ["lets-go-pikachu"], vgs: ["lets-go-pikachu-lets-go-eevee"], regions: [1], gen: 7, breeding: false, dexes: ["letsgo-kanto"], side: true },
  bdsp: { versions: ["brilliant-diamond"], vgs: ["brilliant-diamond-shining-pearl"], regions: [4], gen: 8, breeding: true, dexes: ["original-sinnoh"], beauty: true },
  sword: { versions: ["sword", "the-isle-of-armor-sword", "the-crown-tundra-sword"], vgs: ["sword-shield", "the-isle-of-armor", "the-crown-tundra"], regions: [8], gen: 8, breeding: true, dexes: ["galar", "isle-of-armor", "crown-tundra"] },
  legendsarceus: { versions: ["legends-arceus"], vgs: ["legends-arceus"], regions: [9], gen: 8, breeding: false, dexes: ["hisui"], side: true, linkingCord: true },
  violet: { versions: ["violet", "the-teal-mask-violet", "the-indigo-disk-violet"], vgs: ["scarlet-violet", "the-teal-mask", "the-indigo-disk"], regions: [10], gen: 9, breeding: true, dexes: ["paldea", "kitakami", "blueberry"] },
  legendsza: { versions: ["legends-za"], vgs: ["legends-za", "mega-dimension"], regions: [6], gen: 9, breeding: false, dexes: ["lumiose-city", "hyperspace"], side: true },
};
export const GUIDE_GAMES = Object.keys(GAME_INFO);
const SIDE_VGS = new Set(["lets-go-pikachu-lets-go-eevee", "legends-arceus", "legends-za", "mega-dimension", "colosseum", "xd"]);

// Évolutions par lieu de la Gen 4 (Sinnoh) absentes de la PokéAPI
const SUPPLEMENTS = [
  { to: 462, loc: "Mont Couronné" },
  { to: 476, loc: "Mont Couronné" },
  { to: 470, loc: "Forêt Vestigion, près du Rocher Mousse" },
  { to: 471, loc: "Route 217, près du Rocher Glace" },
];

async function getText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} sur ${url.split("/").pop()}`);
  return r.text();
}
const num = (v) => (v === "" || v == null ? null : Number(v));

// ------------------------------------------------------------------ chargement
let loading = null;
export function loadGuideData({ force = false } = {}) {
  if (loading && !force) return loading;
  loading = (async () => {
    if (!force) {
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (c?.version === 2 && c.evolutions?.length) return c;
      } catch { /* ignore */ }
    }
    const files = ["pokemon_evolution", "evolution_triggers", "version_groups", "versions", "pokemon_species", "item_names", "location_names", "locations", "type_names", "encounters", "pokemon", "pokemon_egg_groups", "pokemon_types"];
    const txt = Object.fromEntries(await Promise.all(files.map(async (f) => [f, await getText(`${CSV}${f}.csv`)])));
    const rows = (f) => parseCSV(txt[f]);

    const triggers = Object.fromEntries(rows("evolution_triggers").map((r) => [r.id, r.identifier]));
    const vgs = Object.fromEntries(rows("version_groups").map((r) => [r.id, { id: r.identifier, order: Number(r.order), gen: Number(r.generation_id) }]));
    const species = {};
    for (const r of rows("pokemon_species")) {
      const id = Number(r.id);
      if (id <= 1025) species[id] = { from: num(r.evolves_from_species_id), chain: num(r.evolution_chain_id) };
    }
    const evolutions = rows("pokemon_evolution")
      .map((r) => {
        const vg = vgs[r.version_group_id];
        return {
          to: Number(r.evolved_species_id),
          trigger: triggers[r.evolution_trigger_id] ?? "unclassified",
          vg: vg?.id ?? null,
          order: vg?.order ?? 0,
          item: num(r.trigger_item_id), level: num(r.minimum_level), gender: num(r.gender_id), location: num(r.location_id),
          held: num(r.held_item_id), time: r.time_of_day || null, move: num(r.known_move_id), moveType: num(r.known_move_type_id),
          happiness: num(r.minimum_happiness), beauty: num(r.minimum_beauty), affection: num(r.minimum_affection),
          stats: num(r.relative_physical_stats), partySpecies: num(r.party_species_id), partyType: num(r.party_type_id),
          tradeSpecies: num(r.trade_species_id), rain: r.needs_overworld_rain === "1", upsideDown: r.turn_upside_down === "1",
          multiplayer: r.needs_multiplayer === "1", nearRock: r.near_special_rock === "1", region: num(r.region_id),
          requiredForm: num(r.required_pokemon_form_id), evolvedForm: num(r.evolved_pokemon_form_id),
          usedMove: num(r.used_move_id), moveCount: num(r.minimum_move_count), steps: num(r.minimum_steps),
          damage: num(r.minimum_damage_taken), nature: r.nature_bitmask ? true : false, chance: num(r.percentage_chance),
        };
      })
      .filter((e) => e.to <= 1025)
      .map((e) => ({ ...e, from: species[e.to]?.from ?? null }));

    const usedItems = new Set(evolutions.flatMap((e) => [e.item, e.held]).filter(Boolean));
    const usedLocs = new Set(evolutions.map((e) => e.location).filter(Boolean));
    const pickNames = (list, key, used) => {
      const out = {};
      for (const r of list) {
        const id = Number(r[key]);
        if (used && !used.has(id)) continue;
        if (r.local_language_id === FR) out[id] = r.name;
        else if (r.local_language_id === EN && !out[id]) out[id] = r.name;
      }
      return out;
    };
    const locRegion = {};
    for (const r of rows("locations")) if (usedLocs.has(Number(r.id))) locRegion[r.id] = num(r.region_id);

    // Rencontres par jeu (versions de l'application, DLC compris)
    const versionId = Object.fromEntries(rows("versions").map((r) => [r.identifier, r.id]));
    const versionToGame = new Map();
    for (const [g, info] of Object.entries(GAME_INFO)) for (const v of info.versions) if (versionId[v]) versionToGame.set(versionId[v], g);
    const pkmSpecies = Object.fromEntries(rows("pokemon").map((r) => [r.id, Number(r.species_id)]));
    const encounters = {};
    for (const r of rows("encounters")) {
      const g = versionToGame.get(r.version_id);
      if (!g) continue;
      const sp = pkmSpecies[r.pokemon_id] ?? Number(r.pokemon_id);
      if (sp <= 1025) (encounters[g] ??= new Set()).add(sp);
    }
    const noEggs = rows("pokemon_egg_groups").filter((r) => r.egg_group_id === "15" && Number(r.species_id) <= 1025).map((r) => Number(r.species_id));
    const types = {};
    for (const r of rows("pokemon_types")) {
      const id = Number(r.pokemon_id);
      if (id <= 1025) (types[id] ??= [])[Number(r.slot) - 1] = Number(r.type_id);
    }
    const data = {
      version: 2,
      evolutions, species, vgOrder: Object.fromEntries(Object.values(vgs).map((v) => [v.id, v.order])),
      itemNames: pickNames(rows("item_names"), "item_id", usedItems),
      locNames: pickNames(rows("location_names"), "location_id", usedLocs),
      typeNames: pickNames(rows("type_names"), "type_id", null),
      locRegion, noEggs, types,
      encounters: Object.fromEntries(Object.entries(encounters).map(([g, s]) => [g, [...s]])),
      fetchedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* trop gros : gardé en mémoire */ }
    return data;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}

// ------------------------------------------------------------------ évolutions valables dans un jeu
const gameOrder = (data, gid) => Math.max(...GAME_INFO[gid].vgs.map((v) => data.vgOrder[v] ?? 0));

/** Toutes les évolutions vers des espèces du Pokédex du jeu, avec les méthodes valables (vide = impossible). */
export function evolutionsInGame(data, gid, inDex) {
  const info = GAME_INFO[gid];
  if (!info) return [];
  const byTarget = new Map();
  for (const e of data.evolutions) (byTarget.get(e.to) ?? byTarget.set(e.to, []).get(e.to)).push(e);
  for (const s of SUPPLEMENTS) {
    const list = byTarget.get(s.to) ?? [];
    if (!list.some((e) => e.location && data.locRegion[e.location] === 4))
      byTarget.set(s.to, [...list, { to: s.to, from: data.species[s.to]?.from, trigger: "level-up", vg: "diamond-pearl", order: data.vgOrder["diamond-pearl"] ?? 12, locName: s.loc, locRegionOverride: 4, supplement: true }]);
  }
  const order = gameOrder(data, gid);
  const out = [];
  for (const [to, list] of byTarget) {
    const from = list[0].from ?? data.species[to]?.from;
    if (!from || (inDex && (!inDex(to) || !inDex(from)))) continue;
    const valid = validRows(data, info, order, list);
    out.push({ from, to, methods: dedupe(valid.map((e) => describe(data, e, info, to))), kind: kindOf(valid) });
  }
  return out.sort((a, b) => a.to - b.to);
}

function validRows(data, info, order, list) {
  const regionOf = (e) => e.locRegionOverride ?? data.locRegion[e.location] ?? null;
  let rows = list.filter((e) => {
    if (e.order > order) return false; // pas encore introduite
    if (e.vg && SIDE_VGS.has(e.vg) && !info.vgs.includes(e.vg)) return false; // méthode d'un jeu « à part »
    if (e.beauty && !info.beauty) return false;
    if (e.affection && info.gen < 6) return false;
    if (e.location || e.locRegionOverride) { const r = regionOf(e); if (r == null ? !info.vgs.includes(e.vg) : !info.regions.includes(r)) return false; }
    if (e.region && !info.regions.includes(e.region)) return false;
    return true;
  });
  // Affection → Amitié à partir de la Gen 8 (sauf si une méthode Amitié existe déjà)
  if (!info.affection && info.gen >= 8)
    rows = rows.map((e) => (e.affection ? { ...e, affection: null, happiness: e.happiness ?? 160 } : e));
  // Une méthode plus récente du même type remplace l'ancienne
  const latest = new Map();
  for (const e of rows) {
    if (e.location || e.locRegionOverride) continue;
    const k = kindKey(e);
    if (!latest.has(k) || latest.get(k).order < e.order) latest.set(k, e);
  }
  return rows.filter((e) => e.location || e.locRegionOverride || latest.get(kindKey(e)) === e);
}

const kindKey = (e) => [e.trigger, e.happiness || e.affection ? "F" : "", e.beauty ? "B" : "", e.held ? "H" : "", e.item ? `I${e.item}` : "", e.time ?? "", e.gender ?? "", e.move || e.moveType ? "M" : "", e.partySpecies || e.partyType ? "P" : "", e.stats ?? "", e.rain ? "R" : "", e.tradeSpecies ? "T" : "", e.nearRock ? "K" : "", e.region ?? ""].join("|");
const dedupe = (arr) => [...new Set(arr)];

/** Catégorie pour regrouper l'affichage. */
function kindOf(valid) {
  if (!valid.length) return "impossible";
  const e = valid[0];
  if (e.trigger === "trade") return "trade";
  if (e.trigger === "use-item") return "item";
  if (e.location || e.locRegionOverride || e.nearRock || e.region) return "place";
  if (e.trigger === "level-up" && (e.happiness || e.affection || e.beauty || e.time || e.move || e.moveType || e.held || e.item || e.partySpecies || e.partyType || e.rain || e.upsideDown || e.gender || e.stats != null)) return "condition";
  if (e.trigger === "level-up") return "level";
  return "special";
}
export const KIND_LABEL = {
  level: "Par niveau",
  item: "Pierres et objets",
  trade: "Échanges",
  condition: "Montée de niveau avec condition (amitié, moment, capacité…)",
  place: "Lieux et régions",
  special: "Méthodes spéciales",
  impossible: "Impossibles dans ce jeu",
};

const TRIGGER = {
  shed: "Apparaît avec Ninjask s'il reste une place dans l'équipe (et une Poké Ball dans le sac)",
  spin: "Tourner sur soi-même en tenant une Friandise",
  "tower-of-darkness": "Réussir la Tour de l'Obscurité",
  "tower-of-waters": "Réussir la Tour de l'Eau",
  "three-critical-hits": "Réussir 3 coups critiques dans un même combat",
  "take-damage": "Subir des dégâts puis passer sous l'arche de pierre",
  "in-battle-level-up": "Monter de niveau pendant un combat",
  "agile-style-move": "Utiliser la capacité en Style Rapide",
  "strong-style-move": "Utiliser la capacité en Style Puissant",
  "recoil-damage": "Perdre des PV par contrecoup sans être mis K.O.",
  "use-move": "Utiliser la capacité",
  "three-defeated-bisharp": "Vaincre 3 Scalproie chefs de groupe en tenant une Plume de Commandant",
  "gimmighoul-coins": "Monter de niveau avec 999 Pièces de Mordudor",
  "meltan-candies": "400 Bonbons Meltan (Pokémon GO)",
  unclassified: "Méthode spéciale",
};

function describe(data, e, info, to) {
  const p = [];
  const item = (id) => data.itemNames[id] ?? `objet n°${id}`;
  const move = (id) => data.moveNames?.[id] ?? `capacité n°${id}`;
  if (e.trigger === "level-up") p.push(e.level ? `Niveau ${e.level}` : "Monter d'un niveau");
  else if (e.trigger === "trade") p.push(info.linkingCord ? "Fil de Liaison" : "Échange");
  else if (e.trigger === "use-item") p.push(item(e.item));
  else p.push(TRIGGER[e.trigger] ?? "Méthode spéciale");
  if (e.trigger === "trade" && info.linkingCord) return "Fil de Liaison";
  if (e.trigger === "level-up" && e.item) p.push(`avec ${item(e.item)}`);
  if (e.held) p.push(`en tenant ${item(e.held)}`);
  if (e.tradeSpecies) p.push("contre l'espèce partenaire (échange croisé)");
  if (e.happiness) p.push("avec beaucoup d'amitié");
  if (e.affection) p.push("avec beaucoup d'affection (Poké Récré / Pokémon Refresh)");
  if (e.beauty) p.push("avec une Beauté élevée (Pokébloc / Poffin)");
  if (e.move) p.push(`en connaissant ${move(e.move)}`);
  if (e.moveType) p.push(`en connaissant une capacité de type ${data.typeNames[e.moveType] ?? e.moveType}`);
  if (e.usedMove) p.push(`(${move(e.usedMove)}${e.moveCount ? ` ×${e.moveCount}` : ""})`);
  else if (e.moveCount) p.push(`×${e.moveCount}`);
  if (e.steps) p.push(`après ${e.steps} pas avec lui hors de sa Poké Ball`);
  if (e.damage) p.push(`(au moins ${e.damage} dégâts subis)`);
  if (e.locName) p.push(`à : ${e.locName}`);
  else if (e.location) p.push(`à : ${data.locNames[e.location] ?? `lieu n°${e.location}`}`);
  if (e.nearRock && !e.location) p.push(to === 471 ? "près du Rocher Glace" : to === 470 ? "près du Rocher Mousse" : "près de la pierre spéciale");
  if (e.time) p.push({ day: "le jour", night: "la nuit", dusk: "au crépuscule", "full-moon": "à la pleine lune" }[e.time] ?? e.time);
  if (e.gender) p.push(e.gender === 1 ? "(femelle)" : "(mâle)");
  if (e.stats != null) p.push(e.stats > 0 ? "si Attaque > Défense" : e.stats < 0 ? "si Attaque < Défense" : "si Attaque = Défense");
  if (e.partySpecies) p.push(`avec ${data.speciesName?.(e.partySpecies) ?? `l'espèce n°${e.partySpecies}`} dans l'équipe`);
  if (e.partyType) p.push(`avec un Pokémon de type ${data.typeNames[e.partyType] ?? e.partyType} dans l'équipe`);
  if (e.rain) p.push("sous la pluie");
  if (e.upsideDown) p.push("console tenue à l'envers");
  if (e.nature) p.push("(forme selon la nature)");
  if (e.multiplayer) p.push("en mode Union (multijoueur)");
  if (e.chance) p.push(`(${e.chance} % de chance)`);
  if (e.requiredForm && e.requiredForm > 10000) p.push("(forme régionale requise)");
  return p.join(" ");
}

// ------------------------------------------------------------------ obtention & transferts
/**
 * Espèces trouvables dans le jeu, avec la raison :
 *  "capture" (lieux de capture PokéAPI), "regional" (Pokédex régional du jeu), "evolution", "reproduction".
 */
export function obtainableInGame(data, gid, gameDex, dexes) {
  const info = GAME_INFO[gid];
  const inDex = (sp) => gameDex[gid]?.set.has(sp);
  const how = new Map();
  const hasEnc = !!data.encounters[gid]?.length;
  for (const sp of data.encounters[gid] ?? []) if (inDex(sp)) how.set(sp, { reason: "capture" });
  // Pokédex régional : sûr si on n'a pas les lieux de capture du jeu ; sinon « à vérifier »
  // (Pokémon donné, fixe, fossile… ou exclusivité de l'autre version)
  for (const d of info.dexes) for (const sp of dexes?.[d] ?? []) if (inDex(sp) && !how.has(sp)) how.set(sp, { reason: hasEnc ? "check" : "regional" });
  const evos = evolutionsInGame(data, gid, inDex).filter((x) => x.methods.length);
  const noEggs = new Set(data.noEggs);
  const baseOf = (sp) => { let s = sp; while (data.species[s]?.from && inDex(data.species[s].from)) s = data.species[s].from; return s; };
  let grew = true;
  while (grew) {
    grew = false;
    const certain = (sp) => how.has(sp) && how.get(sp).reason !== "check";
    for (const ev of evos)
      if (how.has(ev.from) && (!how.has(ev.to) || (how.get(ev.to).reason === "check" && certain(ev.from)))) { how.set(ev.to, { reason: "evolution", from: ev.from }); grew = true; }
    if (info.breeding)
      for (const sp of [...how.keys()]) {
        if (noEggs.has(sp)) continue;
        const baby = baseOf(sp);
        if (!how.has(baby) || (how.get(baby).reason === "check" && how.get(sp).reason !== "check")) { how.set(baby, { reason: "reproduction", from: sp }); grew = true; }
      }
  }
  return { how, hasEncounters: hasEnc };
}

/**
 * Pour un jeu : chaque espèce de son Pokédex introuvable sur place, avec les jeux d'où la faire venir
 * (même génération d'abord, puis la génération la plus proche).
 */
export function transferNeeds(gid, gameDex, obtainable, ctx) {
  const tgt = OFFICIAL_META[gid];
  const ids = gameDex[gid]?.ids ?? [];
  const out = [];
  for (const sp of ids) {
    if (obtainable[gid].how.has(sp)) continue;
    const sources = [];
    for (const src of GUIDE_GAMES) {
      if (src === gid || !obtainable[src]?.how.has(sp)) continue;
      const r = evaluateTransfer({ game: src, species: sp, source: null, moves: [] }, gid, ctx);
      if (r.status === "impossible") continue;
      const S = OFFICIAL_META[src];
      sources.push({ game: src, status: r.status, steps: r.steps, sameGen: S.stage === tgt.stage, stage: S.stage });
    }
    sources.sort((a, b) => (b.sameGen - a.sameGen) || (b.stage - a.stage) || GUIDE_GAMES.indexOf(b.game) - GUIDE_GAMES.indexOf(a.game));
    out.push({ species: sp, sources });
  }
  return out;
}

// ------------------------------------------------------------------ fiche Pokémon (description)
const descCache = new Map();
/** Catégorie et description en français (API REST PokéAPI, à la demande). */
export async function speciesDescription(id) {
  if (descCache.has(id)) return descCache.get(id);
  const r = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  if (!r.ok) throw new Error("Description indisponible");
  const j = await r.json();
  const pick = (arr, field) => (arr.find((x) => x.language.name === "fr") ?? arr.find((x) => x.language.name === "en"))?.[field];
  const flavors = j.flavor_text_entries.filter((x) => x.language.name === "fr");
  const res = {
    genus: pick(j.genera ?? [], "genus") ?? "",
    text: (flavors.at(-1) ?? j.flavor_text_entries.find((x) => x.language.name === "en"))?.flavor_text?.replace(/[\f\n­]+/g, " ") ?? "",
    textGame: flavors.at(-1)?.version?.name ?? null,
    legendary: j.is_legendary, mythical: j.is_mythical, baby: j.is_baby,
  };
  descCache.set(id, res);
  return res;
}
