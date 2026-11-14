// Lecture / écriture des sauvegardes de jeux Pokémon GBA (Gen 3) et NDS (Gen 4),
// pensée pour les ROM hacks : on tolère les octets en trop (pied de page d'émulateur
// DeSmuME, horloge mGBA…), on vérifie les sommes de contrôle et on n'autorise
// l'écriture QUE si la structure a été reconnue avec certitude.
//
// Gen 3 : 128 Ko, 2 emplacements de 14 sections de 4 Ko (signature 0x08012025).
//         Le PC (14 boîtes × 30) est réparti sur les sections 5 à 13.
// Gen 4 : 512 Ko, 2 moitiés de 256 Ko, chacune avec un bloc « général » et un bloc
//         « stockage » (18 boîtes × 30). Checksum CRC16-CCITT en fin de bloc.

import { decodeG3, decodeG4, encryptPK3, encryptPK4, parseGB, parsePK3, parsePK4, parsePK5, parsePK67, unpack73 } from "./pkm.js";

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const w16 = (b, o, v) => { b[o] = v & 0xff; b[o + 1] = (v >>> 8) & 0xff; };
const isZero = (b, o, n) => { for (let i = 0; i < n; i++) if (b[o + i]) return false; return true; };

// =====================================================================  GEN 3
const G3_SIG = 0x08012025;
const G3_SIZES = [3884, 3968, 3968, 3968, 3848, 3968, 3968, 3968, 3968, 3968, 3968, 3968, 3968, 2000];
const G3_DATA = 0xf80; // 3968
const PC_BYTES = 4 + 420 * 80 + 14 * 9 + 14; // 33744

function g3Checksum(b, off, size) {
  let s = 0;
  for (let i = 0; i < size; i += 4) s = (s + u32(b, off + i)) >>> 0;
  return ((s >>> 16) + (s & 0xffff)) & 0xffff;
}

/** Regroupe les sections valides par compteur de sauvegarde (tolère les hacks qui changent l'ordre ou le nombre de sections). */
function gen3Slots(bytes) {
  const groups = new Map();
  let flagged = false;
  for (let off = 0; off + 0x1000 <= bytes.length; off += 0x1000) {
    if (u32(bytes, off + 0xff8) !== G3_SIG) continue;
    const raw = u16(bytes, off + 0xff4);
    if (raw & 0x8000) flagged = true;
    const id = raw & 0x7fff;
    if (id > 31) continue;
    const counter = u32(bytes, off + 0xffc);
    if (!groups.has(counter)) groups.set(counter, {});
    const g = groups.get(counter);
    if (g[id] == null) g[id] = off;
  }
  const slots = [...groups.entries()]
    .filter(([, g]) => Array.from({ length: 14 }, (_, i) => i).every((i) => g[i] != null))
    .map(([index, sections]) => ({ index, sections, count: Object.keys(sections).length }))
    .sort((a, b) => b.index - a.index);
  return { slots, flagged };
}

export const normName = (x) => (x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Nombre de Pokémon dont le surnom est le nom d'espèce par défaut (= numérotation correcte). */
function nicknameScore(mons, names) {
  let n = 0;
  for (const p of mons) {
    if (!p || !p.checksumOk || !p.species || !p.nickname) continue;
    const nick = normName(p.nickname);
    if ((names.idToNames[p.species] ?? []).some((nm) => nm.slice(0, 10) === nick)) n++;
  }
  return n;
}

/** Si le surnom est exactement un nom d'espèce, on l'utilise quand la numérotation ne colle pas. */
function fixFromNickname(p, names) {
  if (!p || !p.nickname || !names) return p;
  const nick = normName(p.nickname);
  if (nick.length < 3) return p;
  if (p.species && (names.idToNames[p.species] ?? []).some((nm) => nm.slice(0, 10) === nick)) return p;
  const id = names.nameToId[nick];
  if (id) { p.species = id; p.speciesFromName = true; }
  return p;
}

function readGen3(bytes, speciesMode = "auto", names = null) {
  const { slots, flagged } = gen3Slots(bytes);
  if (!slots.length) return null;
  const slot = slots[0];
  const nonStandard = flagged || slot.count !== 14;

  // Taille de checksum par section : celle du jeu original, ou la section entière (hacks type CFRU)
  const chkSize = {};
  for (let id = 0; id < 14; id++) {
    const off = slot.sections[id];
    const stored = u16(bytes, off + 0xff6);
    if (g3Checksum(bytes, off, G3_SIZES[id]) === stored) chkSize[id] = G3_SIZES[id];
    else if (g3Checksum(bytes, off, G3_DATA) === stored) chkSize[id] = G3_DATA;
    else chkSize[id] = null;
  }
  const pcValid = !nonStandard && [5, 6, 7, 8, 9, 10, 11, 12, 13].every((id) => chkSize[id]);

  // Équipe : FRLG (0x34/0x38) ou RSE (0x234/0x238) dans la section 1
  const readParty = (mode) => {
    const s1 = slot.sections[1];
    for (const [cOff, pOff] of [[0x34, 0x38], [0x234, 0x238]]) {
      const n = u32(bytes, s1 + cOff);
      if (n < 1 || n > 6) continue;
      const list = [];
      for (let i = 0; i < n; i++) list.push(readMon3(bytes.subarray(s1 + pOff + i * 100, s1 + pOff + i * 100 + 100), mode));
      if (list.every((p) => p && p.checksumOk)) return list;
    }
    return [];
  };

  let boxes, pcPos = null;
  const buildBoxes = (mode) => {
    if (!nonStandard) {
      pcPos = (pcOff) => slot.sections[5 + Math.floor(pcOff / G3_DATA)] + (pcOff % G3_DATA);
      const pc = new Uint8Array(PC_BYTES);
      for (let i = 0; i < PC_BYTES; i++) pc[i] = bytes[pcPos(i)];
      const out = [];
      for (let bx = 0; bx < 14; bx++) {
        const rawName = decodeG3(pc.subarray(4 + 33600 + bx * 9, 4 + 33600 + bx * 9 + 9));
        const name = rawName && !rawName.includes("?") ? rawName : `Boîte ${bx + 1}`;
        const arr = [];
        for (let s = 0; s < 30; s++) {
          const o = 4 + (bx * 30 + s) * 80;
          const p = readMon3(pc.subarray(o, o + 80), mode);
          arr.push(p && p.checksumOk ? p : null); // données incohérentes (zone réutilisée par le hack) : ignorées
        }
        out.push({ name, slots: arr });
      }
      return out;
    }
    // Format compact 73 octets (Emerald Platinum et hacks similaires)
    const packed = readPacked73(bytes, slot);
    if (packed) return packed;
    // Structure modifiée par le hack : on parcourt les sections du PC à la recherche de Pokémon valides
    const found = [];
    const seen = new Set();
    const ids = Object.keys(slot.sections).map(Number).filter((id) => id >= 5).sort((a, b) => a - b);
    for (const chunk of [G3_DATA, 0xff0]) {
      const buf = new Uint8Array(ids.length * chunk);
      ids.forEach((id, k) => buf.set(bytes.subarray(slot.sections[id], slot.sections[id] + chunk), k * chunk));
      for (let o = 0; o + 80 <= buf.length; o += 4) {
        if (isZero(buf, o, 8)) continue;
        const p = readMon3(buf.subarray(o, o + 80), mode);
        if (!p || !p.checksumOk || !p.internalSpecies) continue;
        const key = `${p.pid}:${u16(buf, o + 0x1c)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(p);
      }
    }
    const out = [];
    for (let i = 0; i < found.length; i += 30) {
      const arr = found.slice(i, i + 30);
      while (arr.length < 30) arr.push(null);
      out.push({ name: `Trouvés ${i / 30 + 1}`, slots: arr });
    }
    if (!out.length) out.push({ name: "PC (vide)", slots: Array(30).fill(null) });
    return out;
  };

  // Numérotation des espèces : on détecte les hacks « expansion » sur l'ensemble des Pokémon
  let mode = speciesMode;
  if (mode === "auto" && nonStandard && readPacked73(bytes, slot)) mode = "national";
  if (mode === "auto") {
    const all = (m) => [...readParty(m), ...buildBoxes(m).flatMap((b) => b.slots)].filter((p) => p && p.checksumOk);
    const probe = all("gen3");
    const hasBig = probe.some((p) => p.internalSpecies > 411 || p.internalSpecies >> 11);
    mode = hasBig ? "national" : "gen3";
    if (hasBig && names) {
      // national (pokeemerald-expansion) ou Rouge Feu étendu (CFRU) : on départage avec les surnoms par défaut
      const sc = { national: nicknameScore(all("national"), names), cfru: nicknameScore(all("cfru"), names) };
      if (sc.cfru > sc.national) mode = "cfru";
    }
  }
  boxes = buildBoxes(mode);
  const party = readParty(mode);
  if (names) {
    for (const b of boxes) b.slots.forEach((p) => fixFromNickname(p, names));
    party.forEach((p) => fixFromNickname(p, names));
  }
  const packed = !!boxes.packed;

  return {
    gen: 3,
    platform: "gba",
    game: packed ? `Gen 3 « expansion », PC compact (${boxes.length} boîtes)` : nonStandard ? `Gen 3 modifiée par le hack (${slot.count} sections)` : "Gen 3 (Rubis/Saphir/Émeraude/Rouge Feu/Vert Feuille)",
    speciesMode: mode,
    writable: pcValid,
    warning: packed
      ? "PC au format compact de ce hack : Pokémon lus et convertis au format GBA standard pour la Banque. Écriture dans la sauvegarde désactivée par sécurité."
      : nonStandard
      ? "Sauvegarde au format modifié par le hack : Pokémon retrouvés par analyse (copie vers la Banque possible), écriture désactivée par sécurité."
      : pcValid ? null : "Les sommes de contrôle du PC ne correspondent pas au format standard : lecture seule par sécurité.",
    boxes,
    party,
    _w: pcValid ? { slot, chkSize, pcPos } : null,
  };
}

/** Nom de boîte Gen 3 plausible (lettres/chiffres connus, terminé par 0xFF) ? */
function plausibleName(b) {
  const end = b.indexOf(0xff);
  if (end < 1) return false;
  const txt = decodeG3(b.subarray(0, end + 1));
  return txt.length > 0 && !txt.includes("?");
}

/**
 * PC « compact » : par section (ids 5, 6, …) 54 Pokémon de 73 octets (0xF66 octets),
 * puis 26 octets d'un flux commun : boîte courante (1 o), noms (9 o chacun), fonds d'écran.
 */
function readPacked73(bytes, slot) {
  const ids = Object.keys(slot.sections).map(Number).filter((id) => id >= 5).sort((a, b) => a - b);
  if (ids.length < 2) return null;
  const tail = new Uint8Array(ids.length * 26);
  ids.forEach((id, k) => tail.set(bytes.subarray(slot.sections[id] + 0xf66, slot.sections[id] + 0xf80), k * 26));
  let n = 0;
  while (n < 50 && 1 + (n + 1) * 9 <= tail.length && plausibleName(tail.subarray(1 + n * 9, 1 + n * 9 + 9))) n++;
  if (n < 2) return null;
  const perSector = 54;
  const needSectors = Math.ceil((n * 30) / perSector);
  if (needSectors > ids.length) return null;
  const stream = new Uint8Array(needSectors * 0xf66);
  for (let k = 0; k < needSectors; k++) stream.set(bytes.subarray(slot.sections[ids[k]], slot.sections[ids[k]] + 0xf66), k * 0xf66);
  const boxes = [];
  for (let bx = 0; bx < n; bx++) {
    const slots = [];
    for (let s = 0; s < 30; s++) {
      const o = (bx * 30 + s) * 73;
      const rec = stream.subarray(o, o + 73);
      if (isZero(rec, 0, 73)) { slots.push(null); continue; }
      const p = parsePK3(unpack73(rec), "national");
      if (!p.species) { slots.push(null); continue; }
      p.packed73 = rec.slice();
      slots.push(p);
    }
    boxes.push({ name: decodeG3(tail.subarray(1 + bx * 9, 1 + bx * 9 + 9)) || `Boîte ${bx + 1}`, slots });
  }
  boxes.packed = true;
  return boxes;
}

function readMon3(b, mode = "auto") {
  if (isZero(b, 0, 80)) return null;
  try {
    const p = parsePK3(b.slice(0, b.length === 100 ? 100 : 80), mode);
    if (!p.internalSpecies && !p.pid) return null;
    if (!p.internalSpecies && p.checksumOk) return null;
    return p;
  } catch {
    return null;
  }
}

function writeGen3(save, bytes, box, slot, plainRaw) {
  const { pcPos, chkSize, slot: sl } = save._w;
  const enc = encryptPK3(plainRaw.slice(0, 80));
  const start = 4 + (box * 30 + slot) * 80;
  const touched = new Set();
  for (let i = 0; i < 80; i++) {
    const pos = pcPos(start + i);
    bytes[pos] = enc[i];
    touched.add(5 + Math.floor((start + i) / G3_DATA));
  }
  for (const id of touched) {
    const off = sl.sections[id];
    w16(bytes, off + 0xff6, g3Checksum(bytes, off, chkSize[id]));
  }
}

// =====================================================================  GEN 4
const G4_LAYOUTS = [
  { id: "dp", label: "Diamant / Perle", gSize: 0xc100, sOff: 0xc100, sSize: 0x121e0, footer: 0x14, party: 0x98, boxOff: 4, stride: 0xff0, names: 4 + 18 * 0xff0 },
  { id: "pt", label: "Platine", gSize: 0xcf2c, sOff: 0xcf2c, sSize: 0x121e4, footer: 0x14, party: 0xa0, boxOff: 4, stride: 0xff0, names: 4 + 18 * 0xff0 },
  { id: "hgss", label: "HeartGold / SoulSilver", gSize: 0xf628, sOff: 0xf700, sSize: 0x12310, footer: 0x10, party: 0x98, boxOff: 0, stride: 0x1000, names: 18 * 0x1000 + 4 },
];
const HALF = 0x40000;

export function crc16ccitt(b, off, len) {
  let crc = 0xffff;
  for (let i = 0; i < len; i++) {
    crc ^= b[off + i] << 8;
    for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

/** Infos d'un bloc : checksum valide ? compteur de sauvegarde ? */
function blockInfo(bytes, start, size, footer) {
  if (start + size > bytes.length) return { valid: false, counter: -1 };
  const end = start + size;
  const valid = crc16ccitt(bytes, start, size - footer) === u16(bytes, end - 2);
  let counter = -1;
  for (let o = end - footer; o <= end - 8; o += 4) {
    if (u32(bytes, o) === size && o - 4 >= end - footer) { counter = u32(bytes, o - 4); break; }
  }
  return { valid, counter };
}

function readMon4(b, off) {
  if (off + 136 > b.length || isZero(b, off, 136)) return null;
  try {
    const p = parsePK4(b.slice(off, off + 136));
    if (!p.species) return null;
    return p;
  } catch {
    return null;
  }
}

function countValid4(bytes, start, L) {
  let n = 0;
  for (let bx = 0; bx < 18; bx++)
    for (let s = 0; s < 30; s++) {
      const p = readMon4(bytes, start + L.boxOff + bx * L.stride + s * 136);
      if (p && p.checksumOk && p.species <= 1500) n++;
    }
  return n;
}

/**
 * Cherche le pied de bloc Gen 4 d'un bloc commençant à `start` :
 * … [compteur u32][taille u32][magie u32][id u16][CRC u16] — la taille stockée = taille du bloc.
 * On ne retient que si le CRC16 correspond (pied de 0x10 = HGSS, 0x14 = DP/Pt).
 */
function findBlock4(bytes, start, limit) {
  for (let o = start + 0x100; o + 16 <= limit; o += 4) {
    const size = u32(bytes, o + 4);
    if (size !== o + 16 - start) continue;
    for (const footer of [0x10, 0x14]) {
      if (crc16ccitt(bytes, start, size - footer) === u16(bytes, start + size - 2))
        return { start, size, end: start + size, footer, counter: u32(bytes, o) };
    }
  }
  return null;
}

function detectGen4Half(bytes, h) {
  const limit = Math.min(bytes.length, h + HALF);
  const g = findBlock4(bytes, h, limit);
  if (!g) return null;
  const starts = [g.end, (g.end + 0xff) & ~0xff];
  let st = null;
  for (const s0 of starts) { st = findBlock4(bytes, s0, limit); if (st) break; }
  return { g, st };
}

function gen4Layout(bytes, g, st) {
  // Famille HGSS : boîtes alignées sur 0x1000 ; famille DP/Pt : 4 octets puis boîtes de 0xFF0
  const fam = st.footer === 0x10
    ? { boxOff: 0, stride: 0x1000, n: Math.floor(st.size / 0x1000) }
    : { boxOff: 4, stride: 0xff0, n: Math.floor((st.size - 4) / 0xff0) };
  fam.n = Math.max(1, Math.min(fam.n, 50));
  const vanilla =
    g.size === 0xf628 && st.size === 0x12310 ? "HeartGold / SoulSilver"
    : g.size === 0xc100 && st.size === 0x121e0 ? "Diamant / Perle"
    : g.size === 0xcf2c && st.size === 0x121e4 ? "Platine"
    : null;
  const label = vanilla ?? `${st.footer === 0x10 ? "base HeartGold / SoulSilver" : "base Diamant / Perle / Platine"} modifiée (${fam.n} boîtes)`;
  return { ...fam, label, names: fam.boxOff + fam.n * fam.stride };
}

function readParty4(bytes, gStart) {
  for (const off of [0x98, 0xa0]) {
    const n = bytes[gStart + off - 4];
    if (n < 1 || n > 6) continue;
    const list = [];
    for (let i = 0; i < n; i++) {
      const o = gStart + off + i * 236;
      try { const p = parsePK4(bytes.slice(o, o + 236)); if (p.species && p.checksumOk) list.push(p); } catch { /* ignore */ }
    }
    if (list.length === n) return list;
  }
  return [];
}

function readGen4(bytes) {
  // 1) Détection automatique des blocs (fonctionne avec les hacks qui ont agrandi la sauvegarde)
  const halves = [0, HALF].map((h) => (h < bytes.length ? detectGen4Half(bytes, h) : null));
  const gBest = halves.filter((x) => x?.g).sort((a, b) => b.g.counter - a.g.counter)[0];
  const sBest = halves.filter((x) => x?.st).sort((a, b) => b.st.counter - a.st.counter)[0];
  if (gBest && sBest) {
    const st = sBest.st;
    const L = gen4Layout(bytes, gBest.g, st);
    const boxes = [];
    for (let bx = 0; bx < L.n; bx++) {
      const slots = [];
      for (let s = 0; s < 30; s++) slots.push(readMon4(bytes, st.start + L.boxOff + bx * L.stride + s * 136));
      boxes.push({ name: `Boîte ${bx + 1}`, slots });
    }
    const maxSpecies = Math.max(0, ...boxes.flatMap((b) => b.slots.filter(Boolean).map((p) => p.species)));
    return {
      gen: 4, platform: "nds", game: L.label, writable: true,
      warning: maxSpecies > 493 ? "Hack à Pokédex étendu : les espèces au-delà de la Gen 4 sont lues avec la numérotation nationale." : null,
      boxes, party: readParty4(bytes, gBest.g.start),
      _w: { sStart: st.start, sSize: st.size, footer: st.footer, boxOff: L.boxOff, stride: L.stride },
    };
  }

  // 2) Repli : agencements connus, on prend celui qui contient le plus de Pokémon valides
  let top = { n: 0 };
  for (const Lx of G4_LAYOUTS)
    for (const h of [0, HALF]) {
      const n = countValid4(bytes, h + Lx.sOff, Lx);
      if (n > top.n) top = { n, L: Lx, h };
    }
  if (top.n === 0) return scanGen4(bytes);
  const L = top.L, sStart = top.h + L.sOff;
  const boxes = [];
  for (let bx = 0; bx < 18; bx++) {
    const slots = [];
    for (let s = 0; s < 30; s++) slots.push(readMon4(bytes, sStart + L.boxOff + bx * L.stride + s * 136));
    boxes.push({ name: `Boîte ${bx + 1}`, slots });
  }
  return {
    gen: 4, platform: "nds", game: `${L.label} (structure non vérifiée)`, writable: false,
    warning: "Structure de sauvegarde non standard (hack modifié ?) : Pokémon lus, mais écriture désactivée par sécurité.",
    boxes, party: readParty4(bytes, top.h), _w: null,
  };
}

/** Mode récupération : parcourt la sauvegarde à la recherche de Pokémon valides. */
function scanGen4(bytes) {
  const found = [];
  const seen = new Set();
  const limit = Math.min(bytes.length, HALF) - 136;
  for (let o = 0; o <= limit; o += 4) {
    const chk = u16(bytes, o + 6);
    if (!chk || isZero(bytes, o, 8)) continue;
    const p = readMon4(bytes, o);
    if (!p || !p.checksumOk || p.species > 1500) continue;
    const key = `${p.pid}:${chk}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(p);
  }
  if (!found.length) return null;
  const boxes = [];
  for (let i = 0; i < found.length; i += 30) {
    const slots = found.slice(i, i + 30);
    while (slots.length < 30) slots.push(null);
    boxes.push({ name: `Trouvés ${i / 30 + 1}`, slots });
  }
  return {
    gen: 4, platform: "nds", game: "Format inconnu (mode récupération)", writable: false,
    warning: "Format de sauvegarde non reconnu : mode récupération. Les Pokémon trouvés peuvent être copiés dans la Banque, mais la sauvegarde ne peut pas être modifiée.",
    boxes, party: [], _w: null,
  };
}

function writeGen4(save, bytes, box, slot, plainRaw) {
  const { sStart, sSize, footer, boxOff, stride } = save._w;
  const enc = encryptPK4(plainRaw.slice(0, 136));
  bytes.set(enc, sStart + boxOff + box * stride + slot * 136);
  w16(bytes, sStart + sSize - 2, crc16ccitt(bytes, sStart, sSize - footer));
}

// =====================================================================  GEN 1 / GEN 2
// Sauvegardes de 32 Ko. Les boîtes sont des listes compactes :
//   nombre, liste d'espèces (20 + 0xFF), 20 Pokémon, 20 noms de dresseur, 20 surnoms.
// La boîte « active » du jeu est recopiée dans la banque 1 : on n'écrit jamais dedans.
const GB = {
  1: {
    label: "Rouge / Bleu / Jaune",
    mon: 33, boxSize: 0x462, nBoxes: 12,
    boxAt: (i) => (i < 6 ? 0x4000 + i * 0x462 : 0x6000 + (i - 6) * 0x462),
    current: { data: 0x30c0, index: 0x284c },
    party: 0x2f2c, partyMon: 44,
    main: { start: 0x2598, end: 0x3523 }, // checksum en 0x3523
  },
  2: [
    { label: "Or / Argent", mon: 32, boxSize: 0x450, nBoxes: 14, boxAt: (i) => (i < 7 ? 0x4000 + i * 0x450 : 0x6000 + (i - 7) * 0x450),
      current: { data: 0x2d6c, index: 0x2724 }, party: 0x288a, partyMon: 48, main: { start: 0x2009, end: 0x2d69 } },
    { label: "Cristal", mon: 32, boxSize: 0x450, nBoxes: 14, boxAt: (i) => (i < 7 ? 0x4000 + i * 0x450 : 0x6000 + (i - 7) * 0x450),
      current: { data: 0x2d10, index: 0x2700 }, party: 0x2865, partyMon: 48, main: { start: 0x2009, end: 0x2b83, chk: 0x2d0d } },
  ],
};
const gb1Sum = (b, s, e) => { let x = 0; for (let i = s; i < e; i++) x = (x + b[i]) & 0xff; return ~x & 0xff; };
const gb2Sum = (b, s, e) => { let x = 0; for (let i = s; i < e; i++) x = (x + b[i]) & 0xffff; return x; };

/** Lit une liste compacte (boîte ou équipe). null si la structure n'est pas cohérente. */
function readGBList(bytes, off, gen, monSize, cap) {
  const n = bytes[off];
  if (n > cap) return null;
  if (bytes[off + 1 + n] !== 0xff) return null;
  const monsAt = off + 2 + cap;
  const otAt = monsAt + cap * monSize;
  const nickAt = otAt + cap * 11;
  const list = [];
  for (let k = 0; k < n; k++) {
    const sp = bytes[off + 1 + k];
    const m = bytes.subarray(monsAt + k * monSize, monsAt + k * monSize + monSize);
    if (!sp) return null;
    if (sp !== 0xfd && m[0] !== sp) return null; // 0xFD = œuf (Gen 2)
    const buf = new Uint8Array((gen === 1 ? 33 : 32) + 22);
    buf.set(m.subarray(0, gen === 1 ? 33 : 32), 0);
    buf.set(bytes.subarray(otAt + k * 11, otAt + k * 11 + 11), gen === 1 ? 33 : 32);
    buf.set(bytes.subarray(nickAt + k * 11, nickAt + k * 11 + 11), (gen === 1 ? 33 : 32) + 11);
    const p = parseGB(gen, buf);
    if (sp === 0xfd) p.isEgg = true;
    list.push(p);
  }
  return list;
}

function readGBVariant(bytes, gen, V) {
  let mainOk;
  if (gen === 1) mainOk = gb1Sum(bytes, V.main.start, V.main.end) === bytes[V.main.end];
  else {
    const at = V.main.chk ?? V.main.end;
    mainOk = gb2Sum(bytes, V.main.start, V.main.end) === (bytes[at] | (bytes[at + 1] << 8));
  }
  const cur = bytes[V.current.index] & 0x7f;
  const curIdx = cur < V.nBoxes ? cur : 0;
  let score = mainOk ? 50 : 0;
  const boxes = [];
  for (let i = 0; i < V.nBoxes; i++) {
    const isCur = i === curIdx;
    const off = isCur ? V.current.data : V.boxAt(i);
    const list = readGBList(bytes, off, gen, V.mon, 20);
    const uninit = !list && bytes[off] === 0xff;
    if (list) score += 1 + list.length;
    const slots = Array(20).fill(null);
    (list ?? []).forEach((p, k) => (slots[k] = p));
    boxes.push({ name: `Boîte ${i + 1}`, slots, active: isCur, compact: true, uninit, readable: !!list });
  }
  const party = readGBList(bytes, V.party, gen, V.partyMon, 6) ?? [];
  return { score, mainOk, boxes, party, curIdx };
}

function readGB(bytes) {
  const candidates = [{ gen: 1, V: GB[1] }, ...GB[2].map((V) => ({ gen: 2, V }))];
  let best = null;
  for (const c of candidates) {
    const r = readGBVariant(bytes, c.gen, c.V);
    if (!best || r.score > best.r.score) best = { ...c, r };
  }
  if (!best || best.r.score === 0) return null;
  const { gen, V, r } = best;
  // Écriture seulement si le jeu est reconnu par sa somme de contrôle
  let writable = r.mainOk;
  if (gen === 1 && writable) {
    // chaque banque de boîtes (2 et 3) a une somme globale + une par boîte
    for (const bank of [0x4000, 0x6000]) {
      if (gb1Sum(bytes, bank, bank + 0x1a4c) !== bytes[bank + 0x1a4c]) writable = false;
    }
  }
  return {
    gen, platform: gen === 1 ? "gb" : "gbc", game: V.label, writable,
    warning: writable ? "La boîte active du jeu est en lecture seule (le jeu l'écrase en changeant de boîte)." :
      r.mainOk ? "Les boîtes du PC n'ont jamais été initialisées (change de boîte une fois dans le jeu) : lecture seule." :
      "Somme de contrôle non reconnue (hack modifié ?) : lecture seule par sécurité.",
    boxes: r.boxes, party: r.party, _w: { V, curIdx: r.curIdx },
  };
}

function writeGB(save, bytes, box, plainRaw) {
  const { V } = save._w;
  const gen = save.gen;
  const n0 = gen === 1 ? 33 : 32;
  const off = V.boxAt(box);
  const n = bytes[off];
  if (n >= 20) throw new Error("Boîte pleine.");
  const sp = plainRaw[0];
  bytes[off + 1 + n] = sp;
  bytes[off + 2 + n] = 0xff;
  const monsAt = off + 22;
  bytes.set(plainRaw.subarray(0, n0), monsAt + n * V.mon);
  bytes.set(plainRaw.subarray(n0, n0 + 11), monsAt + 20 * V.mon + n * 11);
  bytes.set(plainRaw.subarray(n0 + 11, n0 + 22), monsAt + 20 * V.mon + 220 + n * 11);
  bytes[off] = n + 1;
  if (gen === 1) {
    const bank = box < 6 ? 0x4000 : 0x6000;
    const bi = box % 6;
    bytes[bank + 0x1a4d + bi] = gb1Sum(bytes, off, off + V.boxSize);
    bytes[bank + 0x1a4c] = gb1Sum(bytes, bank, bank + 0x1a4c);
  }
}

// =====================================================================  GEN 5
// 24 boîtes de 30, chacune dans un bloc de 0x1000 à partir de 0x400 (N/B et N2/B2).
// Lecture seule : la sauvegarde Gen 5 a une table de sommes de contrôle et une copie
// de secours dont la gestion n'est pas encore assez sûre pour écrire dedans.
function readGen5(bytes) {
  const boxes = [];
  let valid = 0, gen5Origin = 0, gen4Origin = 0;
  for (let bx = 0; bx < 24; bx++) {
    const slots = [];
    for (let s = 0; s < 30; s++) {
      const o = 0x400 + bx * 0x1000 + s * 136;
      if (o + 136 > bytes.length || isZero(bytes, o, 136)) { slots.push(null); continue; }
      let p = null;
      try { p = parsePK5(bytes.slice(o, o + 136)); } catch { /* ignore */ }
      if (p && p.species && p.checksumOk) {
        valid++;
        if (p.originGame >= 20 && p.originGame <= 23) gen5Origin++;
        else if ([7, 8, 10, 11, 12].includes(p.originGame)) gen4Origin++;
        slots.push(p);
      } else slots.push(null);
    }
    boxes.push({ name: `Boîte ${bx + 1}`, slots });
  }
  return { valid, gen5Origin, gen4Origin, boxes };
}

// =====================================================================  GEN 6 / 7 (3DS)
// Sauvegardes « main » des jeux 3DS : boîtes de Pokémon chiffrés de 232 octets à une position fixe.
// Lecture seule (la table de sommes de contrôle de ces jeux n'est pas réécrite).
const DS3 = [
  { size: 0x65600, label: "X / Y", gen: 6, box: 0x22600, boxes: 31, party: 0x14200, version: [24, 25] },
  { size: 0x76000, label: "Rubis Oméga / Saphir Alpha", gen: 6, box: 0x33000, boxes: 31, party: 0x14200, version: [26, 27] },
  { size: 0x6be00, label: "Soleil / Lune", gen: 7, box: 0x04e00, boxes: 32, party: 0x01400, version: [30, 31] },
  { size: 0x6cc00, label: "Ultra-Soleil / Ultra-Lune", gen: 7, box: 0x05200, boxes: 32, party: 0x01600, version: [32, 33] },
];
export const is3DSSize = (n) => DS3.some((d) => d.size === n);

function readMon67(bytes, off, len, fmt) {
  if (off + len > bytes.length || isZero(bytes, off, len)) return null;
  try {
    const p = parsePK67(bytes.slice(off, off + len), fmt);
    return p.species && p.checksumOk ? p : null;
  } catch { return null; }
}

function read3DS(bytes) {
  const d = DS3.find((x) => x.size === bytes.length);
  if (!d) return null;
  const fmt = d.gen === 6 ? "pk6" : "pk7";
  const boxes = [];
  for (let bx = 0; bx < d.boxes; bx++) {
    const slots = [];
    for (let s = 0; s < 30; s++) slots.push(readMon67(bytes, d.box + (bx * 30 + s) * 0xe8, 0xe8, fmt));
    boxes.push({ name: `Boîte ${bx + 1}`, slots });
  }
  const party = [];
  for (let i = 0; i < 6; i++) { const p = readMon67(bytes, d.party + i * 0x104, 0x104, fmt); if (p) party.push(p); }
  const n = boxes.reduce((a, b) => a + b.slots.filter(Boolean).length, 0) + party.length;
  if (!n) return null;
  return {
    gen: d.gen, platform: d.gen === 6 ? "3ds6" : "3ds7", game: d.label, writable: false,
    warning: "Sauvegarde 3DS : lecture et copie vers la Banque. L'écriture dans les sauvegardes 3DS n'est pas encore prise en charge.",
    boxes, party, _w: null,
  };
}

// =====================================================================  BALAYAGES GÉNÉRIQUES
/** Cherche partout des Pokémon chiffrés valides (checksum + espèce plausible). */
export function scanFormat(bytes, kind, maxSpecies = 1500) {
  const conf = {
    pk3: { len: 80, parse: (b) => parsePK3(b, "auto") },
    pk4: { len: 136, parse: (b) => parsePK4(b) },
    pk5: { len: 136, parse: (b) => parsePK5(b) },
    pk67: { len: 0xe8, parse: (b) => parsePK67(b, "pk7") },
  }[kind];
  const found = [];
  const seen = new Set();
  for (let o = 0; o + conf.len <= bytes.length; o += 4) {
    const chk = u16(bytes, o + (kind === "pk3" ? 0x1c : 6));
    if (!chk || isZero(bytes, o, 8)) continue;
    let p;
    try { p = conf.parse(bytes.slice(o, o + conf.len)); } catch { continue; }
    const sp = kind === "pk3" ? p.internalSpecies & 0x7ff : p.internalSpecies; // hacks « expansion » : bits en plus au-dessus
    if (!p.checksumOk || !sp || sp > maxSpecies) continue;
    const key = `${p.pid}:${chk}`;
    if (seen.has(key)) continue;
    seen.add(key);
    p._offset = o;
    found.push(p);
  }
  return found;
}

export function boxesFromList(list, prefix = "Trouvés") {
  const boxes = [];
  for (let i = 0; i < list.length; i += 30) {
    const slots = list.slice(i, i + 30);
    while (slots.length < 30) slots.push(null);
    boxes.push({ name: `${prefix} ${i / 30 + 1}`, slots });
  }
  return boxes.length ? boxes : [{ name: "Aucun Pokémon", slots: Array(30).fill(null) }];
}

// =====================================================================  API
/**
 * Ouvre une sauvegarde. Retourne { gen, platform, game, writable, warning, boxes, party, bytes, extra, fileName }.
 */
export function openSave(fileName, buffer, opts = {}) {
  const all = new Uint8Array(buffer);
  const n = all.length;
  let save = null, core, extra;
  if (n >= 0x8000 && n < 0x10000) {
    core = all.slice(0, 0x8000);
    extra = all.slice(0x8000);
    save = readGB(core);
  } else if (n >= 0x10000 && n < 0x40000) {
    core = all.slice(0, Math.min(n, 0x20000));
    extra = all.slice(core.length);
    save = readGen3(core, opts.gen3Species ?? "auto", opts.names ?? null);
  } else if (is3DSSize(n)) {
    core = all.slice();
    extra = new Uint8Array(0);
    save = read3DS(core);
    if (!save) {
      const found = scanFormat(core, "pk67", 1100).map((p) => ({ ...p, format: p.originGame <= 29 && p.originGame >= 24 ? "pk6" : "pk7" }));
      if (found.length) save = { gen: 7, platform: "3ds7", game: "3DS (mode récupération)", writable: false, warning: "Structure 3DS non reconnue : Pokémon retrouvés par balayage.", boxes: boxesFromList(found), party: [], _w: null };
    }
  } else if (n >= 0x40000) {
    const size = n >= 0x80000 ? 0x80000 : 0x40000;
    core = all.slice(0, size);
    extra = all.slice(size);
    const g4 = readGen4(core);
    if (g4 && g4.writable) save = g4; // Gen 4 reconnue avec certitude
    else {
      const g5 = readGen5(core);
      const g4count = g4 ? g4.boxes.reduce((a, b) => a + b.slots.filter(Boolean).length, 0) : 0;
      const prefer5 = g5.valid > 0 && (g5.gen5Origin >= g5.gen4Origin) && g5.valid >= g4count;
      if (prefer5)
        save = {
          gen: 5, platform: "nds5", game: "Noir / Blanc / Noir 2 / Blanc 2", writable: false,
          warning: "Sauvegarde Gen 5 : lecture seule pour l'instant (copie vers la Banque possible, pas d'écriture dans la sauvegarde).",
          boxes: g5.boxes, party: [], _w: null,
        };
      else save = g4;
    }
  }
  if (!save)
    throw new Error(
      n < 0x8000
        ? `Fichier trop petit (${n} octets) : ce n'est pas une sauvegarde Pokémon.`
        : "Aucune structure de sauvegarde Pokémon (Gen 1 à 5) trouvée dans ce fichier.",
    );
  return { ...save, bytes: core, extra, fileName, _names: opts.names ?? null };
}

/** Écrit un Pokémon (octets déchiffrés) dans un emplacement VIDE d'une boîte. */
export function writeToSave(save, box, slot, plainRaw, format) {
  if (!save.writable) throw new Error("Cette sauvegarde est en lecture seule.");
  const b = save.boxes[box];
  if (b.active) throw new Error("C'est la boîte active du jeu : choisis une autre boîte.");
  if (b.slots[slot]) throw new Error("Emplacement déjà occupé.");
  const len = plainRaw.length;
  const byLen = { 55: 1, 54: 2, 80: 3, 100: 3, 220: 5 }[len];
  const fmt = format ? Number(String(format).replace(/\D/g, "")) : byLen ?? (len === 136 || len === 236 ? 4 : null);
  if (fmt !== save.gen) throw new Error(`Ce Pokémon (format Gen ${fmt ?? "?"}) ne peut pas aller dans une sauvegarde Gen ${save.gen}.`);
  const bytes = save.bytes.slice();
  if (save.gen === 3) writeGen3(save, bytes, box, slot, plainRaw);
  else if (save.gen === 4) writeGen4(save, bytes, box, slot, plainRaw);
  else if (save.gen <= 2) {
    if (!b.readable) throw new Error("Boîte non initialisée dans le jeu.");
    writeGB(save, bytes, box, plainRaw);
  } else throw new Error("Écriture non prise en charge pour cette génération.");
  // relecture complète pour vérifier
  const re = save.gen === 3 ? readGen3(bytes, save.speciesMode, save._names) : save.gen === 4 ? readGen4(bytes) : readGB(bytes);
  const target = save.gen <= 2 ? b.slots.filter(Boolean).length : slot;
  const placed = re?.boxes[box]?.slots[target];
  if (!re || !re.writable || !placed || !placed.checksumOk) throw new Error("Vérification après écriture échouée : sauvegarde non modifiée.");
  return { ...re, bytes, extra: save.extra, fileName: save.fileName, modified: true, _names: save._names };
}

export function saveBlob(save) {
  const out = new Uint8Array(save.bytes.length + save.extra.length);
  out.set(save.bytes, 0);
  out.set(save.extra, save.bytes.length);
  return new Blob([out], { type: "application/octet-stream" });
}
