// Analyseur de sauvegarde : pour un hack inconnu (ou modifié), on essaie toutes les méthodes de lecture
// et on rend compte de ce qui a été trouvé, avec des recommandations de réglages.
import { boxesFromList, normName, openSave, scanFormat } from "./savefile.js";
import { parsePK3, parsePK4, parsePK5, parsePK67, shinyValue } from "./pkm.js";

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const hex = (n) => `0x${n.toString(16).toUpperCase()}`;

const allMons = (save) => [...save.boxes.flatMap((b) => b.slots), ...save.party].filter(Boolean);
const countMons = (save) => allMons(save).length;

function nicknameMatches(mons, names) {
  let ok = 0, tested = 0;
  for (const p of mons) {
    if (!p?.nickname || !p.species) continue;
    tested++;
    const nick = normName(p.nickname);
    if ((names?.idToNames[p.species] ?? []).some((nm) => nm.slice(0, 10) === nick || nm === nick)) ok++;
  }
  return { ok, tested };
}

/** Estime la règle shiny : si tous les Pokémon ont une valeur shiny < 2^k avec k petit, ce n'est pas le hasard. */
export function estimateShiny(mons) {
  const vals = mons.map((p) => shinyValue(p.pid, p.tid, p.sid)).filter((v) => v != null);
  const n = vals.length;
  if (!n) return null;
  const max = Math.max(...vals);
  const std = vals.filter((v) => v < 8).length;
  let threshold = 8;
  while (threshold <= max) threshold *= 2;
  const pChance = (threshold / 65536) ** n; // probabilité que ce soit le hasard
  return {
    n, max, standardShiny: std, threshold,
    significant: threshold > 8 && threshold < 65536 && pChance < 1e-6,
    odds: Math.round(65536 / threshold),
  };
}

function scanSave(bytes, kind, label, extra = {}) {
  let found = scanFormat(bytes, kind, kind === "pk3" ? 2047 : 1500);
  if (kind === "pk5") found = found.filter((p) => p.originGame >= 20 && p.originGame <= 23);
  if (kind === "pk4") found = found.filter((p) => !(p.originGame >= 20 && p.originGame <= 23));
  if (kind === "pk67") found = found.map((p) => (p.originGame >= 24 && p.originGame <= 29 ? parsePK67(p.raw, "pk6") : p));
  const platform = { pk3: "gba", pk4: "nds", pk5: "nds5", pk67: "3ds7" }[kind];
  const gen = { pk3: 3, pk4: 4, pk5: 5, pk67: 7 }[kind];
  return {
    gen, platform, game: label, writable: false,
    warning: "Pokémon retrouvés par balayage de tous les octets : lecture seule (copie vers la Banque possible).",
    boxes: boxesFromList(found, "Trouvés"), party: [], _w: null, ...extra,
  };
}

/** Re-décode des Pokémon Gen 3 avec une autre numérotation d'espèces. */
function remapGen3(save, mode) {
  const re = (p) => (p ? Object.assign(parsePK3(p.raw.slice(0, p.raw.length >= 100 ? 100 : 80), mode), { _offset: p._offset }) : null);
  return { ...save, speciesMode: mode, boxes: save.boxes.map((b) => ({ ...b, slots: b.slots.map(re) })), party: save.party.map(re) };
}

export function analyzeSave(fileName, buffer, names) {
  const bytes = new Uint8Array(buffer);
  const n = bytes.length;
  const report = { fileName, size: n, notes: [], results: [] };

  report.sizeLabel =
    n >= 0x8000 && n < 0x10000 ? "32 Ko : Game Boy / Game Boy Color"
    : n >= 0x10000 && n < 0x40000 ? `${Math.round(n / 1024)} Ko : Game Boy Advance (Gen 3)`
    : [0x65600, 0x76000, 0x6be00, 0x6cc00].includes(n) ? "Nintendo 3DS (Gen 6/7)"
    : n >= 0x40000 ? `${Math.round(n / 1024)} Ko : Nintendo DS (Gen 4/5)`
    : `${n} octets : trop petit pour une sauvegarde Pokémon`;
  if (n % 0x400 !== 0) report.notes.push(`Taille non arrondie (${n} octets) : ${n % 0x400} octet(s) en trop, sans doute ajoutés par l'émulateur (horloge, pied de page). Ils sont ignorés et conservés.`);

  // 1) Lecture « structurée » (la même que la Banque)
  try {
    const s = openSave(fileName, buffer, { names });
    report.results.push({ id: "structure", label: `Structure reconnue : ${s.game}`, method: "structure", save: s, count: countMons(s) });
  } catch (e) {
    report.notes.push(`Lecture structurée impossible : ${e.message}`);
  }

  // 2) Gen 3 : comparer les numérotations d'espèces grâce aux surnoms par défaut
  if (n >= 0x10000 && n < 0x40000) {
    const base = report.results[0]?.save?.gen === 3 ? report.results[0].save : null;
    if (base) {
      const modes = ["gen3", "national", "cfru"].map((mode) => {
        const s = remapGen3(base, mode);
        return { mode, score: nicknameMatches(allMons(s), names), save: s };
      });
      report.numbering = modes.map((m) => ({ mode: m.mode, ...m.score }));
      const best = [...modes].sort((a, b) => b.score.ok - a.score.ok)[0];
      if (best.score.ok > 0) report.recommendedNumbering = best.mode;
    }
    const sc = scanSave(bytes, "pk3", "Balayage Gen 3 (Pokémon chiffrés de 80 octets)");
    if (countMons(sc)) {
      const modes = ["gen3", "national", "cfru"].map((mode) => { const s = remapGen3(sc, mode); return { mode, s, score: nicknameMatches(allMons(s), names).ok }; });
      const best = modes.sort((a, b) => b.score - a.score)[0];
      report.results.push({ id: "scan3", label: `${sc.game} · numérotation ${best.mode}`, method: "scan", save: { ...best.s, speciesMode: best.mode }, count: countMons(sc) });
    }
  }

  // 3) DS / 3DS : balayages par format
  if (n >= 0x40000) {
    for (const [kind, label] of [["pk4", "Balayage Gen 4 (136 octets)"], ["pk5", "Balayage Gen 5 (136 octets)"], ["pk67", "Balayage Gen 6/7 (232 octets)"]]) {
      const sc = scanSave(bytes, kind, label);
      const c = countMons(sc);
      if (c) report.results.push({ id: `scan-${kind}`, label, method: "scan", save: sc, count: c });
    }
  }

  // Doublons de balayage (les deux moitiés d'une sauvegarde DS contiennent souvent les mêmes Pokémon)
  report.results.sort((a, b) => (a.method === "structure" ? -1 : b.method === "structure" ? 1 : b.count - a.count));

  // 4) Règle shiny et Pokédex
  const best = report.results.find((r) => r.count > 0);
  if (best) {
    const mons = allMons(best.save);
    report.shiny = estimateShiny(mons);
    const maxSp = Math.max(0, ...mons.map((p) => p.species || 0));
    report.maxSpecies = maxSp;
    report.dexGuess = [151, 251, 386, 493, 649, 721, 809, 905, 1025].find((v) => v >= maxSp) ?? 1025;
    const nm = nicknameMatches(mons, names);
    report.nameCheck = nm;
    if (nm.tested >= 3 && nm.ok / nm.tested < 0.3)
      report.notes.push("Peu de surnoms correspondent aux espèces lues : le hack utilise peut-être une numérotation inconnue. Corrige les espèces à la main dans la Banque, ou envoie la sauvegarde pour ajouter ce format.");
  } else {
    report.notes.push("Aucun Pokémon trouvé avec les formats connus. Le hack stocke peut-être ses Pokémon autrement (format compact, compression) : utilise la comparaison de deux sauvegardes pour repérer où ils sont.");
  }
  return report;
}

// ---------------------------------------------------------------- Comparaison de deux sauvegardes
function gen3SectorMap(bytes) {
  const groups = new Map();
  for (let off = 0; off + 0x1000 <= bytes.length; off += 0x1000) {
    if (u32(bytes, off + 0xff8) !== 0x08012025) continue;
    const id = u16(bytes, off + 0xff4) & 0x7fff;
    const c = u32(bytes, off + 0xffc);
    if (!groups.has(c)) groups.set(c, {});
    groups.get(c)[id] ??= off;
  }
  const best = [...groups.entries()].sort((a, b) => b[0] - a[0])[0];
  return best ? { counter: best[0], sections: best[1] } : null;
}

const keyOf = (p) => `${p.format}:${p.pid}:${p.species}`;
function quickMons(bytes) {
  const out = new Map();
  const add = (list) => list.forEach((p) => out.set(keyOf(p), p));
  const g3 = bytes.length >= 0x10000 && bytes.length < 0x40000 ? gen3SectorMap(bytes) : null;
  if (g3) {
    // GBA : uniquement l'emplacement de sauvegarde le plus récent (l'autre contient l'état précédent)
    const ids = Object.keys(g3.sections).map(Number).sort((x, y) => x - y);
    const buf = new Uint8Array(ids.length * 0xff4);
    ids.forEach((id, k) => buf.set(bytes.subarray(g3.sections[id], g3.sections[id] + 0xff4), k * 0xff4));
    add(scanFormat(buf, "pk3", 2047));
  } else if (bytes.length >= 0x10000 && bytes.length < 0x40000) add(scanFormat(bytes, "pk3", 2047));
  if (bytes.length >= 0x40000) { add(scanFormat(bytes, "pk4")); add(scanFormat(bytes, "pk67")); }
  return out;
}

export function diffSaves(bufA, bufB) {
  const a = new Uint8Array(bufA), b = new Uint8Array(bufB);
  const res = { sizeA: a.length, sizeB: b.length, regions: [], gen3: null, added: [], removed: [] };
  const ga = gen3SectorMap(a), gb = gen3SectorMap(b);
  if (ga && gb) {
    // Gen 3 : on compare section par section (leur position change à chaque sauvegarde)
    res.gen3 = { counterA: ga.counter, counterB: gb.counter };
    const ids = [...new Set([...Object.keys(ga.sections), ...Object.keys(gb.sections)].map(Number))].sort((x, y) => x - y);
    for (const id of ids) {
      const oa = ga.sections[id], ob = gb.sections[id];
      if (oa == null || ob == null) { res.regions.push({ label: `Section ${id}`, changed: null, note: "présente dans une seule sauvegarde" }); continue; }
      let changed = 0, first = -1, last = -1;
      for (let i = 0; i < 0xff4; i++) if (a[oa + i] !== b[ob + i]) { changed++; if (first < 0) first = i; last = i; }
      if (changed) res.regions.push({ label: `Section ${id}${id === 1 ? " (équipe)" : id >= 5 ? " (PC)" : ""}`, changed, range: `${hex(first)} → ${hex(last)}`, at: `A ${hex(oa)} / B ${hex(ob)}` });
    }
  } else {
    const len = Math.min(a.length, b.length);
    for (let page = 0; page < len; page += 0x1000) {
      let changed = 0, first = -1, last = -1;
      for (let i = page; i < Math.min(page + 0x1000, len); i++) if (a[i] !== b[i]) { changed++; if (first < 0) first = i; last = i; }
      if (changed) res.regions.push({ label: `Bloc ${hex(page)}`, changed, range: `${hex(first)} → ${hex(last)}` });
    }
  }
  const ma = quickMons(a), mb = quickMons(b);
  for (const [k, p] of mb) if (!ma.has(k)) res.added.push(p);
  for (const [k, p] of ma) if (!mb.has(k)) res.removed.push(p);
  return res;
}
