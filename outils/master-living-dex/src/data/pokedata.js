// Chargement des données Pokémon depuis la PokéAPI.
// Source principale : les CSV officiels du dépôt PokéAPI (1 requête par fichier,
// contient les noms FR, les Pokédex régionaux, la courbe d'XP et le taux de sexe).
// Repli : l'API REST /pokemon-species?limit=1025 (noms anglais seulement).
// Le résultat est mis en cache dans le localStorage : un seul chargement réseau.

const CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
const REST = "https://pokeapi.co/api/v2/";
const CACHE_KEY = "mld-pokedata-v2";
export const MAX_SPECIES = 1025;
const FR = "5";
const EN = "9";

export const spriteUrl = (id, shiny = false) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? "shiny/" : ""}${id}.png`;

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} sur ${url}`);
  return res.text();
}

const titleCase = (s) => s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("-");

async function loadFromCSV(onProgress) {
  onProgress?.("Téléchargement des espèces…");
  const [speciesTxt, namesTxt, dexTxt, dexNumTxt] = await Promise.all([
    getText(CSV + "pokemon_species.csv"),
    getText(CSV + "pokemon_species_names.csv"),
    getText(CSV + "pokedexes.csv"),
    getText(CSV + "pokemon_dex_numbers.csv"),
  ]);
  onProgress?.("Analyse des données…");
  const species = [];
  for (const r of parseCSV(speciesTxt)) {
    const id = Number(r.id);
    if (id < 1 || id > MAX_SPECIES) continue;
    species[id - 1] = {
      id,
      en: titleCase(r.identifier),
      fr: titleCase(r.identifier),
      gen: Number(r.generation_id),
      gender: Number(r.gender_rate), // -1 asexué, 0..8 = huitièmes femelles
      growth: Number(r.growth_rate_id),
      legendary: r.is_legendary === "1",
      mythical: r.is_mythical === "1",
    };
  }
  for (const r of parseCSV(namesTxt)) {
    const s = species[Number(r.pokemon_species_id) - 1];
    if (!s) continue;
    if (r.local_language_id === FR && r.name) s.fr = r.name;
    if (r.local_language_id === EN && r.name) s.en = r.name;
  }
  const dexNames = Object.fromEntries(parseCSV(dexTxt).map((r) => [r.id, r.identifier]));
  const dexes = {};
  const rows = parseCSV(dexNumTxt);
  rows.sort((a, b) => Number(a.pokedex_number) - Number(b.pokedex_number));
  for (const r of rows) {
    const name = dexNames[r.pokedex_id];
    const sid = Number(r.species_id);
    if (!name || sid > MAX_SPECIES) continue;
    (dexes[name] ??= []).push(sid);
  }
  const clean = species.filter(Boolean);
  if (clean.length < 1000) throw new Error("Liste d'espèces incomplète");
  return { species: clean, dexes, source: "csv" };
}

async function loadFromREST(onProgress) {
  onProgress?.("Repli sur l'API PokéAPI…");
  const res = await fetch(`${REST}pokemon-species?limit=${MAX_SPECIES}`);
  if (!res.ok) throw new Error("PokéAPI indisponible");
  const json = await res.json();
  const species = json.results.map((r) => {
    const id = Number(r.url.split("/").filter(Boolean).pop());
    const gen = id <= 151 ? 1 : id <= 251 ? 2 : id <= 386 ? 3 : id <= 493 ? 4 : id <= 649 ? 5 : id <= 721 ? 6 : id <= 809 ? 7 : id <= 905 ? 8 : 9;
    return { id, en: titleCase(r.name), fr: titleCase(r.name), gen, gender: 4, growth: 0, legendary: false, mythical: false };
  });
  species.sort((a, b) => a.id - b.id);
  return { species, dexes: {}, source: "rest" };
}

export function readCachedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.species?.length ? data : null;
  } catch {
    return null;
  }
}

export async function loadPokeData({ force = false, onProgress } = {}) {
  if (!force) {
    const cached = readCachedData();
    if (cached) return cached;
  }
  let data;
  try {
    data = await loadFromCSV(onProgress);
  } catch (e) {
    console.warn("CSV PokéAPI indisponibles :", e);
    data = await loadFromREST(onProgress);
  }
  data.fetchedAt = new Date().toISOString();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* stockage plein : on garde en mémoire */
  }
  return data;
}

// ---- Noms d'attaques / talents (chargés à la demande pour la Banque) ----
const NAMES_KEY = "mld-movenames-v3";
let namesPromise = null;
export function loadMoveAbilityNames() {
  if (namesPromise) return namesPromise;
  namesPromise = (async () => {
    try {
      const cached = JSON.parse(localStorage.getItem(NAMES_KEY) || "null");
      if (cached?.moves) return cached;
    } catch { /* ignore */ }
    const pick = (rows, idKey) => {
      const out = {};
      for (const r of rows) {
        const id = Number(r[idKey]);
        if (id > 1000) continue; // inclut les attaques/talents récents des hacks à Pokédex étendu
        if (r.local_language_id === FR) out[id] = r.name;
        else if (r.local_language_id === EN && !out[id]) out[id] = r.name;
      }
      return out;
    };
    const [m, a] = await Promise.all([getText(CSV + "move_names.csv"), getText(CSV + "ability_names.csv")]);
    const res = { moves: pick(parseCSV(m), "move_id"), abilities: pick(parseCSV(a), "ability_id") };
    try { localStorage.setItem(NAMES_KEY, JSON.stringify(res)); } catch { /* ignore */ }
    return res;
  })().catch((e) => {
    namesPromise = null;
    throw e;
  });
  return namesPromise;
}

// ---- Courbes d'expérience (id PokéAPI growth_rate) ----
const expFor = (rate, n) => {
  const n3 = n ** 3;
  switch (rate) {
    case 1: return Math.floor((5 * n3) / 4); // lente
    case 2: return n3; // moyenne
    case 3: return Math.floor((4 * n3) / 5); // rapide
    case 4: return Math.floor((6 / 5) * n3 - 15 * n * n + 100 * n - 140); // parabolique
    case 5: // erratique
      if (n < 50) return Math.floor((n3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n3 * (150 - n)) / 100);
      if (n < 98) return Math.floor((n3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n3 * (160 - n)) / 100);
    case 6: // fluctuante
      if (n < 15) return Math.floor((n3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((n3 * (n + 14)) / 50);
      return Math.floor((n3 * (Math.floor(n / 2) + 32)) / 50);
    default: return null;
  }
};

export function levelFromExp(rate, exp) {
  if (!rate || expFor(rate, 2) == null) return null;
  let lvl = 1;
  for (let n = 2; n <= 100; n++) {
    if (exp >= expFor(rate, n)) lvl = n;
    else break;
  }
  return lvl;
}
