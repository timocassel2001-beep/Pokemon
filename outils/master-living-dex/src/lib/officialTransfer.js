// Règles des transferts entre jeux officiels (logique des vrais jeux).
//
//  Gen 1 ⇄ Gen 2 ............ Time Capsule (Gen 2 → Gen 1 : 151 premiers Pokémon, capacités Gen 1 uniquement)
//  Gen 1/2 → Gen 7 .......... Poké Transporter (versions Console Virtuelle 3DS) → Pokémon Bank
//  Gen 3 → Gen 4 ............ Pal Park (DPPt) / Migration (HGSS) — aucune CS
//  Gen 4 → Gen 5 ............ Poké Transfert — aucune CS
//  Gen 5 → Gen 6/7 .......... Poké Transporter → Pokémon Bank
//  Gen 6 → Gen 7 ............ Pokémon Bank (Gen 7 → Gen 6 impossible)
//  Gen 6/7 → Switch ......... Pokémon Bank → Pokémon HOME
//  Switch ⇄ Switch .......... Pokémon HOME (si l'espèce existe dans le jeu cible ; Let's Go : origine Let's Go / GO uniquement)
//  Même génération .......... échange entre jeux compatibles
//  Retour vers une génération plus ancienne : impossible (sauf Time Capsule Gen 2 → Gen 1).

import { GAME_BY_ID } from "../data/games.js";

export const OFFICIAL_META = {
  yellow: { gen: 1, stage: 1, fmt: "pk1", label: "Jaune" },
  crystal: { gen: 2, stage: 2, fmt: "pk2", label: "Cristal" },
  emerald: { gen: 3, stage: 3, fmt: "pk3" },
  firered: { gen: 3, stage: 3, fmt: "pk3" },
  heartgold: { gen: 4, stage: 4, fmt: "pk4" },
  platinum: { gen: 4, stage: 4, fmt: "pk4" },
  white2: { gen: 5, stage: 5, fmt: "pk5" },
  y: { gen: 6, stage: 6, fmt: "pk6" },
  alphasapphire: { gen: 6, stage: 6, fmt: "pk6" },
  ultramoon: { gen: 7, stage: 7, fmt: "pk7" },
  letsgo: { gen: 7, stage: 8, fmt: "pb7", home: true, lgpe: true, max: 809 },
  sword: { gen: 8, stage: 8, fmt: "pk8", home: true, max: 898 },
  bdsp: { gen: 8, stage: 8, fmt: "pb8", home: true, max: 493 },
  legendsarceus: { gen: 8, stage: 8, fmt: "pa8", home: true, max: 905 },
  violet: { gen: 9, stage: 8, fmt: "pk9", home: true, max: 1025 },
  legendsza: { gen: 9, stage: 8, fmt: "pa9", home: true, unconfirmed: true, max: 1025 },
};

// Capacités CS bloquantes
const HM_GEN3 = { 15: "Coupe", 19: "Vol", 57: "Surf", 70: "Force", 148: "Flash", 249: "Éclate-Roc", 127: "Cascade", 291: "Plongée" };
const HM_GEN4 = { 15: "Coupe", 19: "Vol", 57: "Surf", 70: "Force", 432: "Anti-Brume", 250: "Siphon", 249: "Éclate-Roc", 127: "Cascade", 431: "Escalade" };

const name = (id) => GAME_BY_ID[id]?.name ?? id;
const step = (label, detail) => ({ label, detail });

/** Génération des données (format) d'un Pokémon : celle du fichier, pas forcément celle du jeu où il est rangé. */
const dataGen = (mon) => Number(String(mon.source ?? "").replace(/\D/g, "")) || null;

/**
 * Évalue le transfert d'un Pokémon de la Banque officielle (rangé dans `mon.game`) vers `to`.
 * status : "same" | "file" (échange, données inchangées) | "convert" (conversion faite par l'application)
 *          | "track" (possible avec les applis officielles : enregistré pour le suivi, données d'origine gardées)
 *          | "impossible"
 */
export function evaluateTransfer(mon, to, { gameDex, byId } = {}) {
  const from = mon.game;
  const A = OFFICIAL_META[from], B = OFFICIAL_META[to];
  const sp = byId?.[mon.species]?.fr ?? `#${mon.species}`;
  const res = (status, reason, steps = [], warnings = []) => ({ status, reason, steps, warnings });
  if (!A) return res("impossible", "Ce Pokémon n'est rattaché à aucun jeu officiel : choisis d'abord son jeu d'origine (Modifier).");
  if (!B) return res("impossible", "Jeu inconnu.");
  if (from === to) return res("same", "Il est déjà dans ce jeu.");
  if (mon.isEgg) return res("impossible", "Les œufs ne peuvent pas être transférés : fais-le éclore d'abord.");
  if (!mon.species) return res("impossible", "Espèce inconnue : corrige-la d'abord (Modifier).");

  // 1) le chemin (sens du transfert, CS, Time Capsule…), 2) puis l'espèce dans le jeu cible
  const r = route(mon, from, to, A, B, sp, res);
  if (r.status === "impossible") return r;
  if (B.max && mon.species > B.max) return res("impossible", `${sp} n'existe pas dans ${name(to)} (espèce plus récente que le jeu).`);
  const gd = gameDex?.[to];
  if (gd && !gd.set.has(mon.species)) {
    const game = GAME_BY_ID[to];
    if (game?.dex.type === "pokedex")
      r.warnings.unshift(`${sp} n'est pas dans le Pokédex régional de ${name(to)} : HOME refusera le transfert si l'espèce n'existe pas dans les données du jeu.`);
    else return res("impossible", `${sp} n'existe pas dans ${name(to)} (Pokédex limité aux ${gd.ids.length} premières espèces).`);
  }
  if (B.unconfirmed) r.warnings.push(`La compatibilité HOME de ${name(to)} n'est pas confirmée par l'application : vérifie dans HOME.`);
  return r;
}

function route(mon, from, to, A, B, sp, res) {
  const warnings = [];

  const moves = (mon.moves ?? []).filter(Boolean);
  const hmBlock = (table, via) => {
    const hms = moves.filter((m) => table[m]).map((m) => table[m]);
    return hms.length ? `${via} refuse les Pokémon qui connaissent une CS (${hms.join(", ")}) : fais-les oublier avec le Maître des Capacités / l'Effaceur de CS.` : null;
  };

  // ----- Jeux Game Boy
  if (A.stage <= 2 && B.stage <= 2) {
    if (A.gen === 1 && B.gen === 2)
      return res("convert", null, [step("Time Capsule", `Échange ${name(from)} → ${name(to)} via la Time Capsule`)], [
        "Le taux de capture stocké en Gen 1 n'est pas converti en objet tenu.", ...warnings]);
    // Gen 2 → Gen 1
    if (mon.species > 151) return res("impossible", `Time Capsule : seuls les 151 premiers Pokémon peuvent aller en Gen 1 (${sp} est de la Gen 2).`);
    const bad = moves.filter((m) => m > 165);
    if (bad.length) return res("impossible", "Time Capsule : le Pokémon connaît des capacités qui n'existent pas en Gen 1 : fais-les oublier d'abord.");
    if (mon.item) warnings.push("L'objet tenu sera perdu (la Gen 1 ne gère pas les objets tenus).");
    return res("track", null, [step("Time Capsule", `Échange ${name(from)} → ${name(to)}`)], [
      "Conversion Gen 2 → Gen 1 non faite par l'application (types et PV recalculés par le jeu) : le transfert est enregistré pour ton suivi.", ...warnings]);
  }
  if (A.stage <= 2) {
    if (B.lgpe) return res("impossible", "Let's Go n'accepte que des Pokémon venant de Let's Go ou de Pokémon GO.");
    if (B.stage >= 3 && B.stage <= 6)
      return res("impossible", `Les jeux Game Boy ne communiquent pas avec la Gen ${B.gen} : le seul chemin officiel est Poké Transporter (version Console Virtuelle 3DS) vers la Gen 7, puis HOME.`);
    const steps = [step("Console Virtuelle 3DS", `${name(from)} sur 3DS (pas la cartouche Game Boy)`), step("Poké Transporter"), step("Pokémon Bank")];
    if (B.stage === 7) steps.push(step(name(to)));
    else steps.push(step("Pokémon HOME"), step(name(to)));
    return res("track", null, steps, ["Uniquement depuis les versions Console Virtuelle (eShop 3DS).", ...warnings]);
  }
  if (B.stage <= 2) return res("impossible", `Retour impossible : un Pokémon de Gen ${A.gen} ne peut pas aller sur un jeu Game Boy. Les transferts officiels vont seulement vers les générations suivantes.`);

  // ----- Switch ⇄ Switch (HOME)
  if (A.home && B.home) {
    if (B.lgpe && !(mon.originGame === 42 || mon.originGame === 43 || mon.originGame === 34))
      return res("impossible", "Let's Go n'accepte que les Pokémon capturés dans Let's Go ou venant de Pokémon GO.");
    return res(A.fmt === B.fmt ? "file" : "track", null, [step("Pokémon HOME", `${name(from)} → HOME → ${name(to)}`)], warnings);
  }

  // ----- Retour en arrière
  if (B.stage < A.stage)
    return res("impossible", `Un Pokémon de ${A.home ? "la Switch" : `Gen ${A.gen}`} ne peut pas aller en Gen ${B.gen} : les transferts officiels vont seulement vers les générations suivantes.`);
  if (B.lgpe) return res("impossible", "Let's Go n'accepte que les Pokémon capturés dans Let's Go ou venant de Pokémon GO.");

  // ----- Même génération : échange
  if (A.stage === B.stage) {
    if (A.fmt === B.fmt) return res("file", null, [step("Échange", `Échange local entre ${name(from)} et ${name(to)}`)], warnings);
    return res("track", null, [step("Échange")], warnings);
  }

  // ----- Vers les générations suivantes
  const steps = [];
  let stage = A.stage;
  const blocks = [];
  if (stage === 3) {
    const b = hmBlock(HM_GEN3, "Le Pal Park / la Migration");
    if (b) blocks.push(b);
    steps.push(step("Pal Park / Migration", "Vers Diamant/Perle/Platine (Pal Park) ou HeartGold/SoulSilver (Migration)"));
    stage = 4;
    if (B.stage === 4) steps.push(step(name(to)));
  }
  if (stage === 4 && B.stage >= 5) {
    const b = hmBlock(HM_GEN4, "Poké Transfert");
    if (b) blocks.push(b);
    steps.push(step("Poké Transfert", "Depuis une DS Gen 4 vers Noir/Blanc ou Noir 2/Blanc 2"));
    stage = 5;
    if (B.stage === 5) steps.push(step(name(to)));
  }
  if (stage === 5 && B.stage >= 6) { steps.push(step("Poké Transporter"), step("Pokémon Bank")); stage = 6; if (B.stage <= 7) steps.push(step(name(to))); }
  else if (stage === 6 && B.stage >= 7) { steps.push(step("Pokémon Bank")); if (B.stage === 7) steps.push(step(name(to))); }
  if (B.stage >= 8) {
    if (A.stage >= 7 && !steps.some((s) => s.label === "Pokémon Bank")) steps.push(step("Pokémon Bank"));
    steps.push(step("Pokémon HOME"), step(name(to)));
  }
  if (blocks.length) return res("impossible", blocks.join(" "));
  return res("track", null, steps, warnings);
}

export const STATUS_LABEL = {
  same: "Déjà dans ce jeu",
  file: "Échange direct",
  convert: "Conversion",
  track: "Via les applis officielles",
  impossible: "Indisponible",
};
export { dataGen };
