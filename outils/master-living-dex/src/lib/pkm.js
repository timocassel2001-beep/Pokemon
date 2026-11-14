// Lecture des fichiers Pokémon Gen 3 (GBA) et Gen 4 (NDS) au format PKHeX.
//   .pk3 / .ek3 : 80 octets (boîte) ou 100 octets (équipe)
//   .pk4 / .ek4 / .pkm : 136 octets (boîte) ou 236 octets (équipe)
// Les fichiers "pk" sont déchiffrés, les "ek" chiffrés : on détecte automatiquement
// grâce à la somme de contrôle. Les octets stockés dans la Banque sont toujours la
// version déchiffrée (= .pk3 / .pk4 réimportable tel quel dans PKHeX).

export const NATURES = ["Hardi", "Solo", "Brave", "Rigide", "Mauvais", "Assuré", "Docile", "Relax", "Malin", "Lâche", "Timide", "Pressé", "Sérieux", "Jovial", "Naïf", "Modeste", "Doux", "Discret", "Pudique", "Foufou", "Calme", "Gentil", "Malpoli", "Prudent", "Bizarre"];

export const BALLS = {
  1: "Master Ball", 2: "Hyper Ball", 3: "Super Ball", 4: "Poké Ball", 5: "Safari Ball", 6: "Filet Ball",
  7: "Scuba Ball", 8: "Faiblo Ball", 9: "Bis Ball", 10: "Chrono Ball", 11: "Luxe Ball", 12: "Honor Ball",
  13: "Sombre Ball", 14: "Soin Ball", 15: "Rapide Ball", 16: "Mémoire Ball",
  17: "Speed Ball", 18: "Niveau Ball", 19: "Appât Ball", 20: "Masse Ball", 21: "Love Ball",
  22: "Copain Ball", 23: "Lune Ball", 24: "Compét'Ball", 25: "Parc Ball",
};

export const ORIGIN_GAMES = {
  1: "Saphir", 2: "Rubis", 3: "Émeraude", 4: "Rouge Feu", 5: "Vert Feuille", 15: "Colosseum / XD",
  7: "HeartGold", 8: "SoulSilver", 10: "Diamant", 11: "Perle", 12: "Platine",
  20: "Blanc", 21: "Noir", 22: "Blanc 2", 23: "Noir 2",
  24: "X", 25: "Y", 26: "Saphir Alpha", 27: "Rubis Oméga",
  30: "Soleil", 31: "Lune", 32: "Ultra-Soleil", 33: "Ultra-Lune", 34: "Pokémon GO",
  35: "Rouge (CV)", 36: "Vert/Bleu (CV)", 37: "Bleu (CV)", 38: "Jaune (CV)", 39: "Or (CV)", 40: "Argent (CV)", 41: "Cristal (CV)",
  42: "Let's Go Pikachu", 43: "Let's Go Évoli", 44: "Épée", 45: "Bouclier", 47: "Légendes Arceus",
  48: "Diamant Étincelant", 49: "Perle Scintillante", 50: "Écarlate", 51: "Violet",
};

export const STAT_LABELS = ["PV", "Att", "Déf", "Atq Spé", "Déf Spé", "Vit"];

// Ordre des sous-structures selon PID % 24 (Gen 3: G A E M — Gen 4: A B C D, même table)
const ORDERS = ["0123", "0132", "0213", "0231", "0312", "0321", "1023", "1032", "1203", "1230", "1302", "1320", "2013", "2031", "2103", "2130", "2301", "2310", "3012", "3021", "3102", "3120", "3201", "3210"];

// Index interne Gen 3 (277..411) -> n° national (252..386)
const GEN3_INTERNAL = [252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 290, 291, 292, 276, 277, 285, 286, 327, 278, 279, 283, 284, 320, 321, 300, 301, 352, 343, 344, 299, 324, 302, 339, 340, 370, 341, 342, 349, 350, 318, 319, 328, 329, 330, 296, 297, 309, 310, 322, 323, 363, 364, 365, 331, 332, 361, 362, 337, 338, 298, 325, 326, 311, 312, 303, 307, 308, 333, 334, 360, 355, 356, 315, 287, 288, 289, 316, 317, 357, 293, 294, 295, 366, 367, 368, 359, 353, 354, 336, 335, 369, 304, 305, 306, 351, 313, 314, 345, 346, 347, 348, 280, 281, 282, 371, 372, 373, 374, 375, 376, 377, 378, 379, 382, 383, 384, 380, 381, 385, 386, 358];

export function gen3SpeciesToNational(internal) {
  if (internal >= 1 && internal <= 251) return internal;
  if (internal >= 277 && internal <= 411) return GEN3_INTERNAL[internal - 277];
  return null; // espèce inconnue (hack avec Pokédex étendu)
}

// Hacks Rouge Feu « étendus » (type CFRU, ex. Éclat Pourpre) : index d'origine jusqu'à 411,
// 412 = Œuf, 413-438 = formes de Zarbi, puis les Gen 4+ à la suite à partir de 439 (= Tortipouss, n° 387).
export const CFRU_GEN4_START = 439;
export function cfruToNational(internal) {
  if (internal <= 411) return gen3SpeciesToNational(internal);
  if (internal >= CFRU_GEN4_START) {
    const n = internal - CFRU_GEN4_START + 387;
    return n <= 1025 ? n : null;
  }
  return null;
}

/** Valeur shiny Gen 3-5 : TID ^ SID ^ PID haut ^ PID bas (shiny si < seuil, 8 dans les jeux d'origine). */
export const shinyValue = (pid, tid, sid) => (pid == null || tid == null || sid == null ? null : ((tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) & 0xffff));

// --- Jeu de caractères Gen 3 (occidental) ---
const G3 = {};
" ÀÁÂÇÈÉÊËÌ ÎÏÒÓÔŒÙÚÛÑßàá çèéêëì îïòóôœùúûñºª &+".split("").forEach((c, i) => { if (c !== " " || i === 0) G3[i] = c; });
"0123456789!?.-".split("").forEach((c, i) => (G3[0xa1 + i] = c));
Object.assign(G3, { 0xb0: "…", 0xb1: "“", 0xb2: "”", 0xb3: "‘", 0xb4: "’", 0xb5: "♂", 0xb6: "♀", 0xb8: ",", 0xba: "/" });
for (let i = 0; i < 26; i++) { G3[0xbb + i] = String.fromCharCode(65 + i); G3[0xd5 + i] = String.fromCharCode(97 + i); }

export function decodeG3(bytes) {
  let s = "";
  for (const b of bytes) {
    if (b === 0xff) break;
    s += G3[b] ?? "?";
  }
  return s.trim();
}

// --- Jeu de caractères Gen 4 (partiel : chiffres, lettres, ponctuation courante) ---
function g4Char(c) {
  if (c >= 0x121 && c <= 0x12a) return String.fromCharCode(48 + c - 0x121);
  if (c >= 0x12b && c <= 0x144) return String.fromCharCode(65 + c - 0x12b);
  if (c >= 0x145 && c <= 0x15e) return String.fromCharCode(97 + c - 0x145);
  const map = { 0x1de: " ", 0x1ab: "!", 0x1ac: "?", 0x1ad: ",", 0x1ae: ".", 0x1af: "…", 0x1b1: "/", 0x1b2: "‘", 0x1b3: "’", 0x1b4: "“", 0x1b5: "”", 0x1bb: "♂", 0x1bc: "♀", 0x1be: "-" };
  return map[c] ?? "?";
}
export function decodeG4(view, off, len) {
  let s = "";
  for (let i = 0; i < len; i += 2) {
    const c = view.getUint16(off + i, true);
    if (c === 0xffff || c === 0) break;
    s += g4Char(c);
  }
  return s.trim();
}

const sum16 = (bytes, start, end) => {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let s = 0;
  for (let i = start; i < end; i += 2) s = (s + v.getUint16(i, true)) & 0xffff;
  return s;
};

const isShiny = (pid, tid, sid) => ((tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) & 0xffff) < 8;

function unshuffle(data, start, blockSize, orderIdx) {
  const order = ORDERS[orderIdx];
  const out = data.slice();
  for (let pos = 0; pos < 4; pos++) {
    const block = Number(order[pos]);
    out.set(data.subarray(start + pos * blockSize, start + (pos + 1) * blockSize), start + block * blockSize);
  }
  return out;
}

// ------------------------------- GEN 3 -------------------------------
/**
 * speciesMode :
 *  "gen3"     : index interne des jeux GBA d'origine (277..411 = Hoenn dans un ordre propre)
 *  "national" : hacks basés sur pokeemerald-expansion (espèce sur 11 bits = n° national,
 *               attaques sur 11 bits, objet sur 10 bits, expérience sur 21 bits)
 *  "auto"     : "national" si la valeur brute est impossible en Gen 3 d'origine
 */
export function parsePK3(input, speciesMode = "auto") {
  let b = new Uint8Array(input);
  if (b.length !== 80 && b.length !== 100) throw new Error("Taille invalide pour un fichier Gen 3 (80 ou 100 octets attendus)");
  let dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const pid = dv.getUint32(0, true);
  const otid = dv.getUint32(4, true);
  const chk = dv.getUint16(0x1c, true);
  let wasEncrypted = false;
  if (sum16(b, 0x20, 0x50) !== chk) {
    const key = (pid ^ otid) >>> 0;
    const dec = b.slice();
    const ddv = new DataView(dec.buffer);
    for (let i = 0x20; i < 0x50; i += 4) ddv.setUint32(i, (ddv.getUint32(i, true) ^ key) >>> 0, true);
    b = unshuffle(dec, 0x20, 12, pid % 24);
    dv = new DataView(b.buffer);
    wasEncrypted = true;
  }
  const checksumOk = sum16(b, 0x20, 0x50) === chk;
  const internal = dv.getUint16(0x20, true);
  const national = speciesMode === "national" || (speciesMode === "auto" && (internal > 411 || internal >> 11 !== 0));
  const cfru = speciesMode === "cfru";
  const mask = (v, bits) => (national && !cfru ? v & ((1 << bits) - 1) : v);
  const iv = dv.getUint32(0x48, true);
  const origins = dv.getUint16(0x46, true);
  const tid = otid & 0xffff;
  const sid = otid >>> 16;
  return {
    format: "pk3",
    platform: "gba",
    raw: b,
    wasEncrypted,
    checksumOk,
    pid,
    tid,
    sid,
    internalSpecies: internal,
    speciesMode: cfru ? "cfru" : national ? "national" : "gen3",
    species: cfru ? cfruToNational(internal) : national ? ((internal & 0x7ff) >= 1 && (internal & 0x7ff) <= 1025 ? internal & 0x7ff : null) : gen3SpeciesToNational(internal),
    nickname: decodeG3(b.subarray(0x08, 0x12)),
    ot: decodeG3(b.subarray(0x14, 0x1b)),
    language: b[0x12],
    item: mask(dv.getUint16(0x22, true), 10),
    itemLabel: null,
    exp: mask(dv.getUint32(0x24, true), 21),
    friendship: b[0x29],
    moves: [0, 1, 2, 3].map((i) => mask(dv.getUint16(0x2c + i * 2, true), 11)),
    // EV/IV ramenés à l'ordre PV, Att, Déf, AtqSpé, DéfSpé, Vit
    evs: [b[0x38], b[0x39], b[0x3a], b[0x3c], b[0x3d], b[0x3b]],
    ivs: [iv & 31, (iv >>> 5) & 31, (iv >>> 10) & 31, (iv >>> 20) & 31, (iv >>> 25) & 31, (iv >>> 15) & 31],
    isEgg: ((iv >>> 30) & 1) === 1,
    abilitySlot: (iv >>> 31) & 1,
    abilityId: null,
    metLevel: origins & 0x7f,
    originGame: (origins >>> 7) & 0xf,
    ball: (origins >>> 11) & 0xf,
    otGender: origins >>> 15 ? "F" : "M",
    nature: pid % 25,
    shiny: isShiny(pid, tid, sid),
    level: b.length === 100 ? b[0x54] : null,
    gender: null, // déduit plus tard grâce au taux de sexe de l'espèce
    fateful: false,
  };
}

// Sexe Gen 3 : dépend des 8 bits bas du PID et du taux femelle de l'espèce
export function gen3Gender(pid, genderRate) {
  if (genderRate == null) return null;
  if (genderRate < 0) return "N";
  if (genderRate === 0) return "M";
  if (genderRate === 8) return "F";
  const threshold = { 1: 31, 2: 63, 4: 127, 6: 191, 7: 225 }[genderRate] ?? Math.round((genderRate / 8) * 256) - 1;
  return (pid & 0xff) < threshold ? "F" : "M";
}

// ---------------- Format compact 73 octets (hacks « expansion », ex. Emerald Platinum) ----------------
// Dans le PC de certains hacks, les Pokémon ne sont pas chiffrés mais « tassés » au bit près sur 73 octets.
// Positions (en bits, poids faible d'abord) retrouvées en comparant avec l'équipe de la même sauvegarde.
const PACK73 = {
  species: [237, 11], item: [248, 10], exp: [258, 21], ppBonuses: [287, 8], friendship: [295, 8], misc0A: [303, 14],
  moves: [[317, 11], [333, 11], [349, 11], [360, 11]], pp: [[371, 7], [378, 7], [385, 7], [392, 7]],
  evs: [399, 407, 415, 423, 431, 439], contest: [447, 455, 463, 471, 479, 487],
  pokerus: [495, 8], metLocation: [503, 8], metLevel: [511, 7], metGame: [518, 4], otGender: [522, 1],
  ivs: [523, 30], isEgg: [553, 1], abilityBit: [554, 1], ribbons: [555, 29],
  language: [144, 8], flags: [152, 6], ot: [158, 7],
};
export function getBits(bytes, pos, width) {
  let v = 0;
  for (let i = 0; i < width; i++) {
    const p = pos + i;
    if ((bytes[p >> 3] >> (p & 7)) & 1) v += 2 ** i;
  }
  return v;
}
/** Convertit un enregistrement compact de 73 octets en .pk3 standard déchiffré (80 octets, numérotation nationale). */
export function unpack73(rec) {
  const g = (f) => getBits(rec, f[0], f[1]);
  const b = new Uint8Array(80);
  const dv = new DataView(b.buffer);
  b.set(rec.subarray(0, 18), 0); // PID, OTID, surnom
  b[0x12] = g(PACK73.language);
  b[0x13] = g(PACK73.flags);
  for (let i = 0; i < 7; i++) b[0x14 + i] = getBits(rec, PACK73.ot[0] + i * 8, 8);
  dv.setUint16(0x20, g(PACK73.species), true);
  dv.setUint16(0x22, g(PACK73.item), true);
  dv.setUint32(0x24, g(PACK73.exp), true);
  b[0x28] = g(PACK73.ppBonuses);
  b[0x29] = g(PACK73.friendship);
  dv.setUint16(0x2a, g(PACK73.misc0A), true);
  PACK73.moves.forEach((f, i) => dv.setUint16(0x2c + i * 2, g(f), true));
  PACK73.pp.forEach((f, i) => (b[0x34 + i] = g(f)));
  PACK73.evs.forEach((pos, i) => (b[0x38 + i] = getBits(rec, pos, 8)));
  PACK73.contest.forEach((pos, i) => (b[0x3e + i] = getBits(rec, pos, 8)));
  b[0x44] = g(PACK73.pokerus);
  b[0x45] = g(PACK73.metLocation);
  dv.setUint16(0x46, g(PACK73.metLevel) | (g(PACK73.metGame) << 7) | (g(PACK73.otGender) << 15), true);
  dv.setUint32(0x48, (g(PACK73.ivs) + g(PACK73.isEgg) * 2 ** 30 + g(PACK73.abilityBit) * 2 ** 31) >>> 0, true);
  dv.setUint32(0x4c, g(PACK73.ribbons) >>> 0, true);
  dv.setUint16(0x1c, sum16(b, 0x20, 0x50), true);
  return b;
}

// ------------------------------- GEN 4 -------------------------------
function prngXor(bytes, start, end, seed) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let s = seed >>> 0;
  for (let i = start; i < end; i += 2) {
    s = (Math.imul(s, 0x41c64e6d) + 0x6073) >>> 0;
    dv.setUint16(i, dv.getUint16(i, true) ^ (s >>> 16), true);
  }
}

export function parsePK4(input) {
  let b = new Uint8Array(input).slice();
  if (b.length !== 136 && b.length !== 236) throw new Error("Taille invalide pour un fichier Gen 4 (136 ou 236 octets attendus)");
  let dv = new DataView(b.buffer);
  const pid = dv.getUint32(0, true);
  const chk = dv.getUint16(6, true);
  let wasEncrypted = false;
  if (sum16(b, 0x08, 0x88) !== chk) {
    prngXor(b, 0x08, 0x88, chk);
    b = unshuffle(b, 0x08, 32, ((pid & 0x3e000) >>> 13) % 24);
    if (b.length > 136) prngXor(b, 0x88, b.length, pid);
    dv = new DataView(b.buffer);
    wasEncrypted = true;
  }
  const checksumOk = sum16(b, 0x08, 0x88) === chk;
  const iv = dv.getUint32(0x38, true);
  const flags = b[0x40];
  const tid = dv.getUint16(0x0c, true);
  const sid = dv.getUint16(0x0e, true);
  const nicknamed = (iv >>> 31) === 1;
  const hgssBall = b[0x86];
  return {
    format: "pk4",
    platform: "nds",
    raw: b,
    wasEncrypted,
    checksumOk,
    pid,
    tid,
    sid,
    internalSpecies: dv.getUint16(0x08, true),
    species: dv.getUint16(0x08, true) || null,
    nickname: nicknamed ? decodeG4(dv, 0x48, 22) : "",
    nicknamed,
    ot: decodeG4(dv, 0x68, 16),
    language: b[0x17],
    item: dv.getUint16(0x0a, true),
    exp: dv.getUint32(0x10, true),
    friendship: b[0x14],
    abilityId: b[0x15],
    abilitySlot: null,
    moves: [0, 1, 2, 3].map((i) => dv.getUint16(0x28 + i * 2, true)),
    evs: [b[0x18], b[0x19], b[0x1a], b[0x1c], b[0x1d], b[0x1b]],
    ivs: [iv & 31, (iv >>> 5) & 31, (iv >>> 10) & 31, (iv >>> 20) & 31, (iv >>> 25) & 31, (iv >>> 15) & 31],
    isEgg: ((iv >>> 30) & 1) === 1,
    fateful: (flags & 1) === 1,
    gender: flags & 4 ? "N" : flags & 2 ? "F" : "M",
    form: flags >>> 3,
    originGame: b[0x5f],
    ball: Math.max(hgssBall, b[0x83]),
    metLevel: b[0x84] & 0x7f,
    otGender: b[0x84] & 0x80 ? "F" : "M",
    nature: pid % 25,
    shiny: isShiny(pid, tid, sid),
    level: b.length === 236 ? b[0x8c] : null,
  };
}

export function parsePokemonFile(name, buffer) {
  const len = buffer.byteLength;
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (len === 69 || ext === "pk1") return parseGB(1, new Uint8Array(buffer));
  if (len === 73 || ext === "pk2") return parseGB(2, new Uint8Array(buffer));
  if (len === 80 || len === 100 || ext === "pk3" || ext === "ek3") return parsePK3(buffer);
  if (len === 220 || ext === "pk5" || ext === "ek5") return parsePK5(buffer);
  if (ext === "pk6" || ext === "ek6") return parsePK67(buffer, "pk6");
  if (ext === "pk7" || ext === "ek7") return parsePK67(buffer, "pk7");
  if (len === 0xe8 || len === 0x104) {
    const p = parsePK67(buffer, "pk7");
    return p.originGame >= 24 && p.originGame <= 29 ? parsePK67(buffer, "pk6") : p;
  }
  if (ext === "pk8" || ext === "ek8") return parsePK89(buffer, "pk8");
  if (ext === "pb8" || ext === "eb8") return parsePK89(buffer, "pb8");
  if (ext === "pk9" || ext === "ek9") return parsePK89(buffer, "pk9");
  if (len === 0x148 || len === 0x158) {
    const p9 = parsePK89(buffer, "pk9");
    if (p9.checksumOk && (p9.originGame === 50 || p9.originGame === 51)) return p9;
    const p8 = parsePK89(buffer, "pk8");
    return p8.originGame === 48 || p8.originGame === 49 ? { ...p8, format: "pb8" } : p8;
  }
  if (ext === "pa8" || ext === "pb7" || ext === "pa9")
    throw new Error(`Le format .${ext} (Légendes Arceus / Let's Go / Légendes Z-A) n'est pas encore pris en charge : exporte le Pokémon depuis un autre jeu ou via HOME.`);
  if (len === 136 || len === 236 || ext === "pk4" || ext === "ek4" || ext === "pkm") {
    const p4 = parsePK4(buffer);
    // un .pkm de 136 octets peut être de la Gen 5 : on regarde le jeu d'origine
    if (len === 136 && ext !== "pk4" && ext !== "ek4" && p4.originGame >= 20 && p4.originGame <= 23) return parsePK5(buffer);
    return p4;
  }
  throw new Error(`Format non reconnu (${len} octets). Formats acceptés : .pk1 à .pk9, .pb8, .ek3 à .ek9, .pkm.`);
}

// =========================================================== GEN 5 (N/B, N2/B2)
function decrypt45(input) {
  let b = new Uint8Array(input).slice();
  const dv0 = new DataView(b.buffer);
  const pid = dv0.getUint32(0, true);
  const chk = dv0.getUint16(6, true);
  let wasEncrypted = false;
  if (sum16(b, 0x08, 0x88) !== chk) {
    prngXor(b, 0x08, 0x88, chk);
    b = unshuffle(b, 0x08, 32, ((pid & 0x3e000) >>> 13) % 24);
    if (b.length > 136) prngXor(b, 0x88, b.length, pid);
    wasEncrypted = true;
  }
  return { b, pid, chk, wasEncrypted, checksumOk: sum16(b, 0x08, 0x88) === chk };
}

function decodeUTF16(dv, off, len) {
  let s = "";
  for (let i = 0; i < len; i += 2) {
    const c = dv.getUint16(off + i, true);
    if (c === 0xffff || c === 0) break;
    s += c === 0xe08e || c === 0x246d ? "♂" : c === 0xe08f || c === 0x246e ? "♀" : String.fromCharCode(c);
  }
  return s.trim();
}

export function parsePK5(input) {
  const len = input.byteLength ?? input.length;
  if (len !== 136 && len !== 220) throw new Error("Taille invalide pour un fichier Gen 5 (136 ou 220 octets attendus)");
  const { b, pid, wasEncrypted, checksumOk } = decrypt45(input);
  const dv = new DataView(b.buffer);
  const iv = dv.getUint32(0x38, true);
  const flags = b[0x40];
  const tid = dv.getUint16(0x0c, true);
  const sid = dv.getUint16(0x0e, true);
  const nicknamed = iv >>> 31 === 1;
  return {
    format: "pk5", platform: "nds5", raw: b, wasEncrypted, checksumOk, pid, tid, sid,
    internalSpecies: dv.getUint16(0x08, true),
    species: dv.getUint16(0x08, true) || null,
    nickname: nicknamed ? decodeUTF16(dv, 0x48, 22) : "",
    nicknamed,
    ot: decodeUTF16(dv, 0x68, 16),
    language: b[0x17],
    item: dv.getUint16(0x0a, true),
    exp: dv.getUint32(0x10, true),
    friendship: b[0x14],
    abilityId: b[0x15],
    abilitySlot: null,
    hiddenAbility: (b[0x42] & 1) === 1,
    moves: [0, 1, 2, 3].map((i) => dv.getUint16(0x28 + i * 2, true)),
    evs: [b[0x18], b[0x19], b[0x1a], b[0x1c], b[0x1d], b[0x1b]],
    ivs: [iv & 31, (iv >>> 5) & 31, (iv >>> 10) & 31, (iv >>> 20) & 31, (iv >>> 25) & 31, (iv >>> 15) & 31],
    isEgg: ((iv >>> 30) & 1) === 1,
    fateful: (flags & 1) === 1,
    gender: flags & 4 ? "N" : flags & 2 ? "F" : "M",
    form: flags >>> 3,
    nature: b[0x41] < 25 ? b[0x41] : pid % 25,
    originGame: b[0x5f],
    ball: b[0x83],
    metLevel: b[0x84] & 0x7f,
    otGender: b[0x84] & 0x80 ? "F" : "M",
    shiny: isShiny(pid, tid, sid),
    level: b.length === 220 ? b[0x8c] : null,
  };
}
export const encryptPK5 = (plain) => encryptPK4(plain);

// =========================================================== GEN 6 à 9
// Même principe que la Gen 4/5 (PRNG + mélange de 4 blocs) mais la graine est l'« encryption constant »
// (EC, 4 premiers octets) : blocs de 56 o (Gen 6/7) ou 80 o (Gen 8/9).
const G6 = { stored: 0xe8, block: 56 };
const G8 = { stored: 0x148, block: 80 };

function decryptEC(input, L) {
  let b = new Uint8Array(input).slice();
  const dv = new DataView(b.buffer);
  const ec = dv.getUint32(0, true);
  const chk = dv.getUint16(6, true);
  let wasEncrypted = false;
  if (sum16(b, 0x08, L.stored) !== chk || (chk === 0 && !isZeroArr(b))) {
    prngXor(b, 0x08, L.stored, ec);
    b = unshuffle(b, 0x08, L.block, ((ec >>> 13) & 31) % 24);
    if (b.length > L.stored) prngXor(b, L.stored, b.length, ec);
    wasEncrypted = true;
  }
  return { b, ec, wasEncrypted, checksumOk: sum16(b, 0x08, L.stored) === chk };
}
const isZeroArr = (b) => b.every((x) => x === 0);

export function encryptEC(plain, gen) {
  const L = gen >= 8 ? G8 : G6;
  const b = new Uint8Array(plain).slice();
  const dv = new DataView(b.buffer);
  const ec = dv.getUint32(0, true);
  const order = ORDERS[((ec >>> 13) & 31) % 24];
  const out = b.slice();
  for (let pos = 0; pos < 4; pos++) out.set(b.subarray(0x08 + Number(order[pos]) * L.block, 0x08 + (Number(order[pos]) + 1) * L.block), 0x08 + pos * L.block);
  prngXor(out, 0x08, L.stored, ec);
  if (out.length > L.stored) prngXor(out, L.stored, out.length, ec);
  return out;
}

const gen6Gender = (v) => ["M", "F", "N"][v & 3] ?? null;

/** .pk6 (X/Y, ROSA) et .pk7 (Soleil/Lune, USUL) : 232 o (boîte) / 260 o (équipe). */
export function parsePK67(input, format = "pk7") {
  const len = input.byteLength ?? input.length;
  if (len !== 0xe8 && len !== 0x104) throw new Error("Taille invalide pour un fichier Gen 6/7 (232 ou 260 octets)");
  const { b, ec, wasEncrypted, checksumOk } = decryptEC(input, G6);
  const dv = new DataView(b.buffer);
  const iv = dv.getUint32(0x74, true);
  const pid = dv.getUint32(0x18, true);
  const tid = dv.getUint16(0x0c, true), sid = dv.getUint16(0x0e, true);
  const version = b[0xdf];
  const gen = format === "pk6" ? 6 : 7;
  return {
    format, platform: gen === 6 ? "3ds6" : "3ds7", gen, raw: b, wasEncrypted, checksumOk, ec, pid, tid, sid,
    internalSpecies: dv.getUint16(0x08, true), species: dv.getUint16(0x08, true) || null,
    nicknamed: iv >>> 31 === 1, nickname: decodeUTF16(dv, 0x40, 0x18), ot: decodeUTF16(dv, 0xb0, 0x18),
    item: dv.getUint16(0x0a, true), exp: dv.getUint32(0x10, true), friendship: b[0xca],
    abilityId: b[0x14], abilitySlot: null, hiddenAbility: b[0x15] === 4,
    moves: [0, 1, 2, 3].map((i) => dv.getUint16(0x5a + i * 2, true)),
    evs: [b[0x1e], b[0x1f], b[0x20], b[0x22], b[0x23], b[0x21]],
    ivs: [iv & 31, (iv >>> 5) & 31, (iv >>> 10) & 31, (iv >>> 20) & 31, (iv >>> 25) & 31, (iv >>> 15) & 31],
    isEgg: ((iv >>> 30) & 1) === 1, fateful: (b[0x1d] & 1) === 1, gender: gen6Gender(b[0x1d] >> 1), form: b[0x1d] >> 3,
    nature: b[0x1c] < 25 ? b[0x1c] : null, originGame: version, ball: b[0xdc], metLevel: b[0xdd] & 0x7f, otGender: b[0xdd] & 0x80 ? "F" : "M",
    shiny: ((tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) & 0xffff) < 16,
    level: len === 0x104 ? b[0xec] : null,
  };
}

/** .pk8 (Épée/Bouclier), .pb8 (DÉ/PS), .pk9 (Écarlate/Violet) : 0x148 o (boîte) / 0x158 o (équipe). */
export function parsePK89(input, format = "pk8") {
  const len = input.byteLength ?? input.length;
  if (len !== 0x148 && len !== 0x158) throw new Error("Taille invalide pour un fichier Gen 8/9 (328 ou 344 octets)");
  const { b, ec, wasEncrypted, checksumOk } = decryptEC(input, G8);
  const dv = new DataView(b.buffer);
  const iv = dv.getUint32(0x8c, true);
  const pid = dv.getUint32(0x1c, true);
  const tid = dv.getUint16(0x0c, true), sid = dv.getUint16(0x0e, true);
  const is9 = format === "pk9";
  const internal = dv.getUint16(0x08, true);
  return {
    format, platform: is9 ? "sw9" : "sw8", gen: is9 ? 9 : 8, raw: b, wasEncrypted, checksumOk, ec, pid, tid, sid,
    internalSpecies: internal,
    // En Écarlate/Violet, les espèces de la Gen 9 ont un index interne différent du n° national :
    // on les résout ensuite par le nom (le surnom d'un Pokémon non surnommé est son nom d'espèce).
    species: internal && (!is9 || internal <= 905) ? internal : null,
    nicknamed: iv >>> 31 === 1, nickname: decodeUTF16(dv, 0x58, 0x1a), ot: decodeUTF16(dv, 0xf8, 0x1a),
    item: dv.getUint16(0x0a, true), exp: dv.getUint32(0x10, true), friendship: null,
    abilityId: dv.getUint16(0x14, true), abilitySlot: null, hiddenAbility: (b[0x16] & 7) === 4,
    moves: [0, 1, 2, 3].map((i) => dv.getUint16(0x72 + i * 2, true)),
    evs: [b[0x26], b[0x27], b[0x28], b[0x2a], b[0x2b], b[0x29]],
    ivs: [iv & 31, (iv >>> 5) & 31, (iv >>> 10) & 31, (iv >>> 20) & 31, (iv >>> 25) & 31, (iv >>> 15) & 31],
    isEgg: ((iv >>> 30) & 1) === 1, fateful: (b[0x22] & 1) === 1,
    gender: gen6Gender(is9 ? b[0x22] >> 1 : b[0x22] >> 2), form: dv.getUint16(0x24, true),
    nature: b[0x20] < 25 ? b[0x20] : null, originGame: is9 ? b[0xce] : b[0xde], ball: b[0x124], metLevel: b[0x125] & 0x7f, otGender: b[0x125] & 0x80 ? "F" : "M",
    shiny: ((tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) & 0xffff) < 16,
    level: null,
  };
}

// =========================================================== GEN 1 / GEN 2 (GB / GBC)
// Index interne Gen 1 (1..190) -> n° national (0 = MissingNo.)
export const GEN1_INTERNAL = [0,
  112, 115, 32, 35, 21, 100, 34, 80, 2, 103, 108, 102, 88, 94, 29, 31, 104, 111, 131, 59,
  151, 130, 90, 72, 92, 123, 120, 9, 127, 114, 0, 0, 58, 95, 22, 16, 79, 64, 75, 113,
  67, 122, 106, 107, 24, 47, 54, 96, 76, 0, 126, 0, 125, 82, 109, 0, 56, 86, 50, 128,
  0, 0, 0, 83, 48, 149, 0, 0, 0, 84, 60, 124, 146, 144, 145, 132, 52, 98, 0, 0,
  0, 37, 38, 25, 26, 0, 0, 147, 148, 140, 141, 116, 117, 0, 0, 27, 28, 138, 139, 39,
  40, 133, 136, 135, 134, 66, 41, 23, 46, 61, 62, 13, 14, 15, 0, 85, 57, 51, 49, 87,
  0, 0, 10, 11, 12, 68, 0, 55, 97, 42, 150, 143, 129, 0, 0, 89, 0, 99, 91, 0,
  101, 36, 110, 53, 105, 0, 93, 63, 65, 17, 18, 121, 1, 3, 73, 0, 118, 119, 0, 0,
  0, 0, 77, 78, 19, 20, 33, 30, 74, 137, 142, 0, 81, 0, 0, 4, 7, 5, 8, 6,
  0, 0, 0, 0, 43, 44, 45, 69, 70, 71,
];
export const gen1ToNational = (i) => GEN1_INTERNAL[i] || null;
export const nationalToGen1 = (n) => { const i = GEN1_INTERNAL.indexOf(n); return i > 0 ? i : null; };

const GB_CHARS = {};
for (let i = 0; i < 26; i++) { GB_CHARS[0x80 + i] = String.fromCharCode(65 + i); GB_CHARS[0xa0 + i] = String.fromCharCode(97 + i); }
for (let i = 0; i < 10; i++) GB_CHARS[0xf6 + i] = String(i);
Object.assign(GB_CHARS, { 0x7f: " ", 0x9a: "(", 0x9b: ")", 0x9c: ":", 0xba: "é", 0xe0: "'", 0xe3: "-", 0xe6: "?", 0xe7: "!", 0xe8: ".", 0xef: "♂", 0xf4: ",", 0xf5: "♀" });
export function decodeGB(bytes) {
  let s = "";
  for (const c of bytes) {
    if (c === 0x50 || c === 0x00) break;
    s += GB_CHARS[c] ?? "?";
  }
  return s.trim();
}

const be16 = (b, o) => (b[o] << 8) | b[o + 1];
const be24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];

/**
 * Pokémon Gen 1 / Gen 2. Stockage interne dans la Banque :
 *   Gen 1 : 33 o (format boîte) + 11 o nom du dresseur + 11 o surnom = 55 o
 *   Gen 2 : 32 o (format boîte) + 11 + 11 = 54 o
 * Accepte aussi les fichiers PKHeX .pk1 (69 o) / .pk2 (73 o) (format « liste »).
 */
export function parseGB(gen, input) {
  const src = new Uint8Array(input);
  const boxLen = gen === 1 ? 33 : 32;
  const partyLen = gen === 1 ? 44 : 48;
  let box, ot, nick, partyLevel = null;
  if (src.length === boxLen + 22) {
    box = src.slice(0, boxLen); ot = src.slice(boxLen, boxLen + 11); nick = src.slice(boxLen + 11);
  } else if (src.length === 3 + partyLen + 22) {
    const party = src.subarray(3, 3 + partyLen);
    box = party.slice(0, boxLen);
    partyLevel = gen === 1 ? party[0x21] : party[0x1f];
    ot = src.slice(3 + partyLen, 3 + partyLen + 11);
    nick = src.slice(3 + partyLen + 11, 3 + partyLen + 22);
  } else throw new Error(`Taille invalide pour un fichier Gen ${gen}`);
  const raw = new Uint8Array(boxLen + 22);
  raw.set(box, 0); raw.set(ot, boxLen); raw.set(nick, boxLen + 11);

  const o = gen === 1 ? { moves: 8, tid: 0x0c, exp: 0x0e, sx: 0x11, dv: 0x1b } : { moves: 2, tid: 6, exp: 8, sx: 0x0b, dv: 0x15 };
  const species = gen === 1 ? gen1ToNational(box[0]) : box[0] >= 1 && box[0] <= 251 ? box[0] : null;
  const atk = box[o.dv] >> 4, def = box[o.dv] & 15, spe = box[o.dv + 1] >> 4, spc = box[o.dv + 1] & 15;
  const hp = ((atk & 1) << 3) | ((def & 1) << 2) | ((spe & 1) << 1) | (spc & 1);
  const sx = [0, 1, 2, 3, 4].map((i) => be16(box, o.sx + i * 2)); // PV, Att, Déf, Vit, Spé
  return {
    format: gen === 1 ? "pk1" : "pk2",
    platform: gen === 1 ? "gb" : "gbc",
    raw,
    checksumOk: !!species,
    pid: null,
    tid: be16(box, o.tid),
    sid: null,
    internalSpecies: box[0],
    species,
    nickname: decodeGB(nick),
    ot: decodeGB(ot),
    item: gen === 2 ? box[1] : null,
    exp: be24(box, o.exp),
    friendship: gen === 2 ? box[0x1b] : null,
    moves: [0, 1, 2, 3].map((i) => box[o.moves + i]),
    ivs: [hp, atk, def, spc, spc, spe],
    ivMax: 15,
    evs: [sx[0], sx[1], sx[2], sx[4], sx[4], sx[3]],
    isEgg: false,
    abilityId: null,
    abilitySlot: null,
    nature: null,
    ball: null,
    metLevel: gen === 2 ? box[0x1e] & 0x3f || null : null,
    originGame: null,
    gender: null, // Gen 2 : déduit de l'IV d'Attaque + taux de l'espèce
    atkDV: atk,
    // Chromatique (Gen 2, ou Gen 1 une fois transféré) : Déf/Vit/Spé = 10 et Att ∈ {2,3,6,7,10,11,14,15}
    shiny: def === 10 && spe === 10 && spc === 10 && [2, 3, 6, 7, 10, 11, 14, 15].includes(atk),
    level: (gen === 1 ? box[3] : box[0x1f]) || partyLevel,
    fateful: false,
  };
}

/**
 * Time Capsule : Pokémon Gen 1 (stockage interne 55 o) → Gen 2 (54 o).
 * Mêmes capacités, DV, Stat Exp, expérience, ID, noms (même jeu de caractères) ; amitié de base 70.
 */
export function gen1ToGen2(raw1) {
  const s = new Uint8Array(raw1);
  const out = new Uint8Array(54);
  const nat = gen1ToNational(s[0]);
  if (!nat) throw new Error("Espèce Gen 1 inconnue");
  out[0] = nat; // n° national
  out[1] = 0; // objet tenu (le taux de capture n'est pas converti)
  out.set(s.subarray(8, 12), 2); // capacités
  out.set(s.subarray(12, 14), 6); // ID dresseur
  out.set(s.subarray(14, 17), 8); // expérience
  out.set(s.subarray(17, 27), 11); // Stat Exp
  out.set(s.subarray(27, 29), 21); // DV
  out.set(s.subarray(29, 33), 23); // PP
  out[27] = 70; // amitié
  out[31] = s[3]; // niveau
  out.set(s.subarray(33, 55), 32); // nom du dresseur + surnom
  return out;
}

export function gen2Gender(atkDV, genderRate) {
  if (genderRate == null) return null;
  if (genderRate < 0) return "N";
  if (genderRate === 0) return "M";
  if (genderRate === 8) return "F";
  return atkDV < genderRate * 2 ? "F" : "M";
}

/** Fichier .pk1/.pk2 (format liste PKHeX) à partir du stockage interne. Les stats d'équipe sont recalculées par le jeu. */
export function gbToFile(gen, raw) {
  const boxLen = gen === 1 ? 33 : 32;
  const partyLen = gen === 1 ? 44 : 48;
  const out = new Uint8Array(3 + partyLen + 22);
  out[0] = 1; out[1] = raw[0]; out[2] = 0xff;
  out.set(raw.subarray(0, boxLen), 3);
  if (gen === 1) out[3 + 0x21] = raw[3];
  out.set(raw.subarray(boxLen, boxLen + 22), 3 + partyLen);
  return out;
}

// --- base64 <-> octets pour le stockage ---
export function bytesToB64(bytes) {
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s);
}
export function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Ré-encode un fichier Gen 3/4 déchiffré (pour tests et export .ek)
export function encryptPK3(plain) {
  const b = new Uint8Array(plain).slice();
  const dv = new DataView(b.buffer);
  const pid = dv.getUint32(0, true);
  const key = (pid ^ dv.getUint32(4, true)) >>> 0;
  const order = ORDERS[pid % 24];
  const out = b.slice();
  for (let pos = 0; pos < 4; pos++) out.set(b.subarray(0x20 + Number(order[pos]) * 12, 0x20 + (Number(order[pos]) + 1) * 12), 0x20 + pos * 12);
  const odv = new DataView(out.buffer);
  for (let i = 0x20; i < 0x50; i += 4) odv.setUint32(i, (odv.getUint32(i, true) ^ key) >>> 0, true);
  return out;
}
export function encryptPK4(plain) {
  const b = new Uint8Array(plain).slice();
  const dv = new DataView(b.buffer);
  const pid = dv.getUint32(0, true);
  const chk = dv.getUint16(6, true);
  const order = ORDERS[((pid & 0x3e000) >>> 13) % 24];
  const out = b.slice();
  for (let pos = 0; pos < 4; pos++) out.set(b.subarray(0x08 + Number(order[pos]) * 32, 0x08 + (Number(order[pos]) + 1) * 32), 0x08 + pos * 32);
  prngXor(out, 0x08, 0x88, chk);
  if (out.length > 136) prngXor(out, 0x88, out.length, pid);
  return out;
}
