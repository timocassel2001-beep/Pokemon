import JSZip from "jszip";
import { bytesToB64, b64ToBytes, gbToFile, gen2Gender, gen3Gender, parsePokemonFile } from "./pkm.js";
import { levelFromExp } from "../data/pokedata.js";

/** Lit des fichiers et renvoie [{ name, ok, mon?, error? }] */
export async function readPokemonFiles(files, byId) {
  const out = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      try {
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const entries = Object.values(zip.files).filter((f) => !f.dir && /\.(pk[1-9]|ek[3-9]|pb8|pkm|3gpkm)$/i.test(f.name));
        for (const ent of entries) out.push(parseOne(ent.name.split("/").pop(), await ent.async("arraybuffer"), byId));
        if (!entries.length) out.push({ name: file.name, ok: false, error: "Aucun fichier .pk3/.pk4 dans l'archive" });
      } catch (e) {
        out.push({ name: file.name, ok: false, error: "Archive illisible" });
      }
      continue;
    }
    out.push(parseOne(file.name, await file.arrayBuffer(), byId));
  }
  return out;
}

const nameIndexCache = new WeakMap();
const norm = (x) => (x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function nameIndex(byId) {
  let idx = nameIndexCache.get(byId);
  if (!idx) {
    idx = {};
    for (const sp of Object.values(byId)) for (const n of [norm(sp.fr), norm(sp.en)]) if (n && idx[n] == null) idx[n] = sp.id;
    nameIndexCache.set(byId, idx);
  }
  return idx;
}

/** Transforme un Pokémon décodé (parsePK1 … parsePK9) en fiche de Banque. */
export function recordFromParsed(p, byId, fileName = null) {
  let nameWarn = null;
  if ((p.gen ?? 0) >= 6 && p.nickname && !p.nicknamed) {
    // Gen 6+ : un Pokémon non surnommé porte le nom de son espèce → résolution / vérification
    const byName = nameIndex(byId)[norm(p.nickname)];
    if (!p.species && byName) p.species = byName;
    else if (p.species && byName && byName !== p.species) nameWarn = `Le nom « ${p.nickname} » ne correspond pas à l'espèce lue : données à vérifier.`;
  }
  const sp = p.species ? byId[p.species] : null;
  if (p.format === "pk3" && sp) p.gender = gen3Gender(p.pid, sp.gender);
  if (p.format === "pk2" && sp) p.gender = gen2Gender(p.atkDV, sp.gender);
  if (p.level == null && sp) p.level = levelFromExp(sp.growth, p.exp);
  const mon = {
    source: p.format,
    platform: p.platform,
    raw: bytesToB64(p.raw),
    fileName,
    checksumOk: p.checksumOk,
    pid: p.pid,
    tid: p.tid,
    sid: p.sid,
    internalSpecies: p.internalSpecies,
    species: p.species,
    nickname: p.nickname,
    level: p.level,
    exp: p.exp,
    shiny: p.shiny,
    gender: p.gender,
    nature: p.nature,
    abilityId: p.abilityId,
    abilitySlot: p.abilitySlot,
    item: p.item,
    moves: p.moves,
    ivs: p.ivs,
    ivMax: p.ivMax ?? 31,
    hiddenAbility: p.hiddenAbility ?? false,
    evs: p.evs,
    ball: p.ball,
    metLevel: p.metLevel,
    originGame: p.originGame,
    ot: p.ot,
    otGender: p.otGender,
    isEgg: p.isEgg,
    fateful: p.fateful,
    friendship: p.friendship,
    notes: "",
    packed73: p.packed73 ? bytesToB64(p.packed73) : undefined,
    speciesMode: p.speciesMode,
    gen: p.gen ?? null,
    ec: p.ec ?? null,
    form: p.form ?? null,
  };
  let warn = nameWarn;
  if (!p.checksumOk) warn = "Somme de contrôle incorrecte : fichier corrompu ou structure modifiée par le hack";
  else if (!p.species) warn = `Espèce interne #${p.internalSpecies} inconnue (Pokédex étendu) : choisis l'espèce à la main`;
  return { mon, warn };
}

function parseOne(name, buffer, byId) {
  try {
    const p = parsePokemonFile(name, buffer);
    const { mon, warn } = recordFromParsed(p, byId, name);
    return { name, ok: true, mon, warn };
  } catch (e) {
    return { name, ok: false, error: e.message };
  }
}

export const monExt = (m) => m.source; // pk1 … pk5

export function monFileName(m, byId) {
  const sp = m.species ? byId[m.species]?.fr ?? `#${m.species}` : "Inconnu";
  const nick = m.nickname && m.nickname !== sp ? ` (${m.nickname})` : "";
  const pid = m.pid != null && m.pid !== "" ? ` - ${(m.pid >>> 0).toString(16).toUpperCase().padStart(8, "0")}` : "";
  return `${String(m.species ?? 0).padStart(4, "0")}${m.shiny ? " ★" : ""} - ${sp}${nick}${pid}.${monExt(m)}`.replace(/[\\/:*?"<>|]/g, "_");
}

export function monFileBytes(m) {
  const raw = b64ToBytes(m.raw);
  if (m.source === "pk1") return gbToFile(1, raw);
  if (m.source === "pk2") return gbToFile(2, raw);
  return raw;
}
export const monBlob = (m) => new Blob([monFileBytes(m)], { type: "application/octet-stream" });

/** Archive .zip des fichiers .pk3/.pk4, un dossier par boîte + un index lisible. */
export async function zipMons(mons, boxes, byId, hacks) {
  const zip = new JSZip();
  const boxName = Object.fromEntries(boxes.map((b) => [b.id, b.name]));
  const hackName = Object.fromEntries(hacks.map((h) => [h.id, h.name]));
  const lines = ["Boîte;Emplacement;Espèce;Surnom;Niveau;Shiny;Hack;Fichier;Notes"];
  for (const m of mons) {
    const folder = (boxName[m.box] ?? "Boîte").replace(/[\\/:*?"<>|]/g, "_");
    const fname = m.raw ? monFileName(m, byId) : "";
    if (m.raw) zip.file(`${folder}/${String(m.slot + 1).padStart(2, "0")} - ${fname}`, monFileBytes(m));
    lines.push([boxName[m.box], m.slot + 1, byId[m.species]?.fr ?? "", m.nickname ?? "", m.level ?? "", m.shiny ? "oui" : "", hackName[m.hack] ?? "", fname || "(saisie manuelle)", (m.notes ?? "").replace(/[\n;]/g, " ")].join(";"));
  }
  zip.file("index.csv", "﻿" + lines.join("\n"));
  return zip.generateAsync({ type: "blob" });
}
