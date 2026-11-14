// Stockage 100 % local (localStorage).
// Deux parties indépendantes :
//   dex  : suivi du Master Living Dex sur les jeux officiels
//          dex[idEspèce][idJeu] = { caught, shinyCaught, transferQuota, eventRequired }
//   vault: plusieurs Banques de Pokémon issus de ROM hacks (Gen 1 à 5) + liste des hacks commune
//          state.bank = Banque active (boîtes, Pokémon) + hacks, pour les vues
import { useSyncExternalStore } from "react";

const DEX_KEY = "mld-dex-v2";
const BANK_KEY = "mld-bank-v2"; // ancienne Banque unique (migrée)
const VAULT_KEY = "mld-vault-v1";
const PREFS_KEY = "mld-prefs-v2";
const TARGETS_KEY = "mld-targets-v1";
const LEGACY_KEY = "master-dex-save-v1"; // sauvegarde de la version Lovable

export const BOX_SIZE = 30;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const DEFAULT_HACKS = [
  { id: "eclat-pourpre", name: "Éclat Pourpre V2", platform: "gba", base: "Rouge Feu", dexMax: 1025 },
  { id: "emerald-platinum", name: "Emerald Platinum", platform: "gba", base: "Émeraude", dexMax: 493 },
  { id: "coeur-or-ultra", name: "Cœur d'Or Ultra", platform: "nds", base: "HeartGold / SoulSilver", shinyThreshold: 16384, dexMax: 1025 },
  { id: "autre-gba", name: "Autre hack GBA", platform: "gba", base: "Rouge Feu / Émeraude" },
  { id: "autre-nds", name: "Autre hack NDS Gen 4", platform: "nds", base: "DP / Platine / HGSS" },
  { id: "autre-gb", name: "Autre hack Game Boy", platform: "gb", base: "Rouge / Bleu / Jaune" },
  { id: "autre-gbc", name: "Autre hack Game Boy Color", platform: "gbc", base: "Or / Argent / Cristal" },
  { id: "autre-nds5", name: "Autre hack Noir/Blanc", platform: "nds5", base: "Noir / Blanc / N2 / B2" },
];

const newBank = (name = "Banque principale", kind = "hack") => ({
  id: uid(),
  name,
  kind, // "official" (jeux officiels) | "hack" (ROM hacks)
  boxes: Array.from({ length: 8 }, (_, i) => ({ id: uid(), name: `Boîte ${i + 1}` })),
  mons: [],
});
const defaultBank = () => ({ ...newBank(), hacks: DEFAULT_HACKS.map((h) => ({ ...h })) });
const defaultVault = () => {
  const off = newBank("Jeux officiels", "official");
  const hk = newBank("ROM hacks", "hack");
  return { banks: [off, hk], active: off.id, hacks: DEFAULT_HACKS.map((h) => ({ ...h })) };
};

/** Corrige / complète la liste des hacks (nouvelles plateformes, règle shiny). */
function fixHacks(hacks) {
  let out = (hacks?.length ? hacks : DEFAULT_HACKS).map((h) => {
    const { allShiny, ...rest } = h; // ancienne option « tout shiny » remplacée par un seuil shiny
    if (rest.id === "coeur-or-ultra" && rest.shinyThreshold == null) rest.shinyThreshold = 16384;
    const preset = DEFAULT_HACKS.find((d) => d.id === rest.id);
    if (rest.dexMax == null && preset?.dexMax) rest.dexMax = preset.dexMax;
    return rest;
  });
  for (const h of DEFAULT_HACKS) if (!out.some((x) => x.id === h.id) && h.id.startsWith("autre-")) out = [...out, { ...h }];
  return out;
}

function loadVault() {
  const v = read(VAULT_KEY, null);
  if (v?.banks?.length) {
    // banques existantes : celles d'avant la séparation officiels / hacks deviennent des banques « ROM hacks »
    let banks = v.banks.map((b) => ({ ...b, kind: b.kind ?? "hack" }));
    if (!banks.some((b) => b.kind === "official")) banks = [newBank("Jeux officiels", "official"), ...banks];
    return { ...v, banks, hacks: fixHacks(v.hacks), active: banks.some((b) => b.id === v.active) ? v.active : banks[0].id };
  }
  const old = read(BANK_KEY, null);
  if (old?.mons) {
    const b = { id: uid(), name: "ROM hacks", kind: "hack", boxes: old.boxes?.length ? old.boxes : newBank().boxes, mons: old.mons };
    return { banks: [newBank("Jeux officiels", "official"), b], active: b.id, hacks: fixHacks(old.hacks) };
  }
  return defaultVault();
}
const activeBankOf = (vault) => {
  const b = vault.banks.find((x) => x.id === vault.active) ?? vault.banks[0];
  return { ...b, hacks: vault.hacks };
};

const read = (k, fallback) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

// ---------- état ----------
let state = {
  dex: read(DEX_KEY, null) ?? read(LEGACY_KEY, null) ?? {},
  vault: loadVault(),
  bank: null,
  prefs: { quickMode: true, activeGame: "yellow", shinyGoal: "none", ...(read(PREFS_KEY, null) ?? {}) },
  targets: read(TARGETS_KEY, null) ?? {},
};
state.bank = activeBankOf(state.vault);
let saveError = null;
const listeners = new Set();
const timers = {};

function persist(key, value) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      saveError = null;
    } catch (e) {
      saveError = "Stockage local plein ou indisponible : exporte ta sauvegarde !";
      console.error(e);
    }
    emit();
  }, 150);
}

function emit() {
  for (const l of listeners) l();
}
function set(part, value) {
  if (part === "bank") {
    // la Banque active est écrite dans le coffre (vault) ; les hacks sont communs à toutes les Banques
    const { hacks, ...bank } = value;
    const vault = { ...state.vault, hacks: hacks ?? state.vault.hacks, banks: state.vault.banks.map((b) => (b.id === state.vault.active ? { ...b, ...bank, id: b.id } : b)) };
    state = { ...state, vault, bank: activeBankOf(vault) };
    persist(VAULT_KEY, vault);
  } else if (part === "vault") {
    state = { ...state, vault: value, bank: activeBankOf(value) };
    persist(VAULT_KEY, value);
  } else {
    state = { ...state, [part]: value };
    persist({ dex: DEX_KEY, prefs: PREFS_KEY, targets: TARGETS_KEY }[part], value);
  }
  emit();
}
const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useStore = (selector) => useSyncExternalStore(subscribe, () => selector(state));
export const getState = () => state;
export const getSaveError = () => saveError;

window.addEventListener?.("beforeunload", () => {
  try {
    localStorage.setItem(DEX_KEY, JSON.stringify(state.dex));
    localStorage.setItem(VAULT_KEY, JSON.stringify(state.vault));
    localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
    localStorage.setItem(TARGETS_KEY, JSON.stringify(state.targets));
  } catch { /* ignore */ }
});

// ---------- préférences ----------
export const setPref = (k, v) => set("prefs", { ...state.prefs, [k]: v });

// ---------- Living Dex ----------
export const EMPTY_ENTRY = Object.freeze({ caught: false, shinyCaught: false, transferQuota: 0, shinyQuota: 0, eventRequired: null });
/** Case du Living Dex remplie dans ce jeu (normal ou shiny). */
export const isFilled = (e) => !!(e && (e.caught || e.shinyCaught));
export const getEntry = (dex, sid, gid) => dex[sid]?.[gid] ?? EMPTY_ENTRY;

export function updateEntry(sid, gid, patch) {
  const cur = getEntry(state.dex, sid, gid);
  const next = { ...EMPTY_ENTRY, ...cur, ...patch };
  next.transferQuota = Math.max(0, Math.min(999, Number(next.transferQuota) || 0));
  next.shinyQuota = Math.max(0, Math.min(999, Number(next.shinyQuota) || 0));
  if (next.eventRequired != null && !String(next.eventRequired).trim()) next.eventRequired = null;
  const empty = !next.caught && !next.shinyCaught && !next.transferQuota && !next.shinyQuota && !next.eventRequired;
  const games = { ...(state.dex[sid] ?? {}) };
  if (empty) delete games[gid];
  else games[gid] = next;
  const dex = { ...state.dex };
  if (Object.keys(games).length) dex[sid] = games;
  else delete dex[sid];
  set("dex", dex);
}

export function bulkSetCaught(gid, ids, caught) {
  const dex = { ...state.dex };
  for (const sid of ids) {
    const cur = dex[sid]?.[gid] ?? EMPTY_ENTRY;
    const next = { ...EMPTY_ENTRY, ...cur, caught };
    const games = { ...(dex[sid] ?? {}) };
    if (!next.caught && !next.shinyCaught && !next.transferQuota && !next.shinyQuota && !next.eventRequired) delete games[gid];
    else games[gid] = next;
    if (Object.keys(games).length) dex[sid] = games;
    else delete dex[sid];
  }
  set("dex", dex);
}

// ---------- Synchronisation sauvegarde → Dex ----------
/**
 * counts[idEspèce] = { normal, shiny } (nombre d'exemplaires trouvés dans la sauvegarde)
 * opts.replace : décoche les espèces absentes de la sauvegarde ; opts.quotas : doublons → quota de transfert
 */
export function syncDex(gid, counts, opts = {}) {
  const dex = { ...state.dex };
  const ids = new Set([...Object.keys(counts).map(Number), ...(opts.replace ? Object.keys(dex).map(Number).filter((sid) => dex[sid]?.[gid]) : [])]);
  let changed = 0;
  for (const sid of ids) {
    const c = counts[sid] ?? { normal: 0, shiny: 0 };
    const cur = dex[sid]?.[gid] ?? EMPTY_ENTRY;
    const next = { ...EMPTY_ENTRY, ...cur };
    if (opts.replace) { next.caught = c.normal > 0; next.shinyCaught = c.shiny > 0; }
    else { next.caught = cur.caught || c.normal > 0; next.shinyCaught = cur.shinyCaught || c.shiny > 0; }
    if (opts.quotas) { next.transferQuota = Math.max(0, c.normal - 1); next.shinyQuota = Math.max(0, c.shiny - 1); }
    const games = { ...(dex[sid] ?? {}) };
    const empty = !next.caught && !next.shinyCaught && !next.transferQuota && !next.shinyQuota && !next.eventRequired;
    if (JSON.stringify(cur) !== JSON.stringify(next)) changed++;
    if (empty) delete games[gid]; else games[gid] = next;
    if (Object.keys(games).length) dex[sid] = games; else delete dex[sid];
  }
  set("dex", dex);
  return changed;
}

// ---------- Objectifs de captures ----------
/** targets[idEspèce] = { normal?: number, shiny?: number } (absent = automatique) */
export function setTarget(sid, kind, value) {
  const t = { ...(state.targets[sid] ?? {}) };
  if (value == null) delete t[kind];
  else t[kind] = Math.max(0, Math.min(999, Math.round(value)));
  const targets = { ...state.targets };
  if (Object.keys(t).length) targets[sid] = t;
  else delete targets[sid];
  set("targets", targets);
}

// ---------- Banques multiples ----------
export function createBank(name, kind = "hack") {
  const b = newBank(name?.trim() || `Banque ${state.vault.banks.length + 1}`, kind);
  set("vault", { ...state.vault, banks: [...state.vault.banks, b], active: b.id });
  return b;
}
export function switchBank(id) {
  if (state.vault.banks.some((b) => b.id === id)) set("vault", { ...state.vault, active: id });
}
export function renameBank(id, name) {
  set("vault", { ...state.vault, banks: state.vault.banks.map((b) => (b.id === id ? { ...b, name: name.trim() || b.name } : b)) });
}
export function deleteBank(id) {
  const target = state.vault.banks.find((b) => b.id === id);
  // on garde toujours au moins une banque de chaque type
  if (!target || state.vault.banks.filter((b) => b.kind === target.kind).length <= 1) return false;
  const banks = state.vault.banks.filter((b) => b.id !== id);
  set("vault", { ...state.vault, banks, active: state.vault.active === id ? banks[0].id : state.vault.active });
  return true;
}
/** Envoie des Pokémon de la Banque active vers une autre Banque (premiers emplacements libres). */
export function sendToBank(monIds, targetId) {
  const v = state.vault;
  const src = v.banks.find((b) => b.id === v.active);
  const dst = v.banks.find((b) => b.id === targetId);
  if (!src || !dst || src.id === dst.id || src.kind !== dst.kind) return 0;
  const moving = src.mons.filter((m) => monIds.includes(m.id));
  const boxes = [...dst.boxes];
  const used = new Set(dst.mons.map((m) => `${m.box}:${m.slot}`));
  const placed = [];
  let bi = 0, slot = 0;
  for (const m of moving) {
    while (true) {
      if (bi >= boxes.length) boxes.push({ id: uid(), name: `Boîte ${boxes.length + 1}` });
      if (slot >= BOX_SIZE) { bi++; slot = 0; continue; }
      if (used.has(`${boxes[bi].id}:${slot}`)) { slot++; continue; }
      break;
    }
    used.add(`${boxes[bi].id}:${slot}`);
    placed.push({ ...m, box: boxes[bi].id, slot });
  }
  set("vault", {
    ...v,
    banks: v.banks.map((b) =>
      b.id === src.id ? { ...b, mons: b.mons.filter((m) => !monIds.includes(m.id)) }
      : b.id === dst.id ? { ...b, boxes, mons: [...b.mons, ...placed] } : b),
  });
  return placed.length;
}

// ---------- Banque ----------
export function addBox(name) {
  const b = state.bank;
  set("bank", { ...b, boxes: [...b.boxes, { id: uid(), name: name || `Boîte ${b.boxes.length + 1}` }] });
}
export function renameBox(id, name) {
  const b = state.bank;
  set("bank", { ...b, boxes: b.boxes.map((x) => (x.id === id ? { ...x, name } : x)) });
}
export function deleteBox(id) {
  const b = state.bank;
  if (b.mons.some((m) => m.box === id) || b.boxes.length <= 1) return false;
  set("bank", { ...b, boxes: b.boxes.filter((x) => x.id !== id) });
  return true;
}

/** Ajoute des Pokémon dans les premiers emplacements libres à partir de la boîte donnée. */
export function addMons(list, startBoxId) {
  const b = state.bank;
  const boxes = [...b.boxes];
  const mons = [...b.mons];
  const used = new Set(mons.map((m) => `${m.box}:${m.slot}`));
  let bi = Math.max(0, boxes.findIndex((x) => x.id === startBoxId));
  let slot = 0;
  const placed = [];
  for (const mon of list) {
    while (true) {
      if (bi >= boxes.length) boxes.push({ id: uid(), name: `Boîte ${boxes.length + 1}` });
      if (slot >= BOX_SIZE) { bi++; slot = 0; continue; }
      if (used.has(`${boxes[bi].id}:${slot}`)) { slot++; continue; }
      break;
    }
    const m = { ...mon, id: uid(), box: boxes[bi].id, slot, addedAt: new Date().toISOString() };
    used.add(`${m.box}:${slot}`);
    mons.push(m);
    placed.push(m);
  }
  set("bank", { ...b, boxes, mons });
  return placed;
}

/** Dépose un Pokémon à un emplacement précis (s'il est libre), sinon au premier libre. */
export function addMonAt(mon, box, slot) {
  const b = state.bank;
  if (b.mons.some((m) => m.box === box && m.slot === slot)) return addMons([mon], box)[0];
  const m = { ...mon, id: uid(), box, slot, addedAt: new Date().toISOString() };
  set("bank", { ...b, mons: [...b.mons, m] });
  return m;
}
export function addBoxes(n) {
  const b = state.bank;
  const boxes = [...b.boxes];
  for (let i = 0; i < n; i++) boxes.push({ id: uid(), name: `Boîte ${boxes.length + 1}` });
  set("bank", { ...b, boxes });
}
export function moveBox(id, dir) {
  const boxes = [...state.bank.boxes];
  const i = boxes.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= boxes.length) return;
  [boxes[i], boxes[j]] = [boxes[j], boxes[i]];
  set("bank", { ...state.bank, boxes });
}

/**
 * Applique des transferts entre jeux officiels dans la banque active.
 * items : [{ id, to, patch? (données converties), via }] ; dexUpdate : coche la cible, retire 1 du quota d'origine.
 */
export function applyTransfers(items, { dexUpdate = true } = {}) {
  const b = state.bank;
  const byId = Object.fromEntries(items.map((x) => [x.id, x]));
  const at = new Date().toISOString();
  const moved = [];
  const mons = b.mons.map((m) => {
    const t = byId[m.id];
    if (!t) return m;
    moved.push({ before: m, to: t.to });
    return { ...m, ...(t.patch ?? {}), game: t.to, history: [...(m.history ?? []), { from: m.game, to: t.to, via: t.via ?? null, at }] };
  });
  set("bank", { ...b, mons });
  if (dexUpdate) {
    const dex = { ...state.dex };
    for (const { before: m, to } of moved) {
      if (!m.species) continue;
      const games = { ...(dex[m.species] ?? {}) };
      const tgt = { ...EMPTY_ENTRY, ...(games[to] ?? {}) };
      if (m.shiny) tgt.shinyCaught = true; else tgt.caught = true;
      games[to] = tgt;
      if (m.game && games[m.game]) {
        const src = { ...EMPTY_ENTRY, ...games[m.game] };
        if (m.shiny && src.shinyQuota > 0) src.shinyQuota--;
        else if (!m.shiny && src.transferQuota > 0) src.transferQuota--;
        games[m.game] = src;
      }
      dex[m.species] = games;
    }
    set("dex", dex);
  }
  return moved.length;
}

export function updateMon(id, patch) {
  const b = state.bank;
  set("bank", { ...b, mons: b.mons.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
}
export function deleteMon(id) {
  const b = state.bank;
  set("bank", { ...b, mons: b.mons.filter((m) => m.id !== id) });
}
/** Déplace un Pokémon vers un emplacement ; échange si l'emplacement est occupé. */
export function moveMon(id, box, slot) {
  const b = state.bank;
  const mon = b.mons.find((m) => m.id === id);
  if (!mon) return;
  const other = b.mons.find((m) => m.box === box && m.slot === slot && m.id !== id);
  set("bank", {
    ...b,
    mons: b.mons.map((m) => {
      if (m.id === id) return { ...m, box, slot };
      if (other && m.id === other.id) return { ...m, box: mon.box, slot: mon.slot };
      return m;
    }),
  });
}
export function saveHacks(hacks) {
  set("bank", { ...state.bank, hacks });
}

// ---------- Sauvegarde complète ----------
export function exportSave() {
  return { app: "master-living-dex", version: 4, exportedAt: new Date().toISOString(), dex: state.dex, targets: state.targets, shinyGoal: state.prefs.shinyGoal, vault: state.vault };
}

/** Accepte le format v2 ou l'ancien format Lovable (objet dex brut). */
export function importSave(json) {
  if (!json || typeof json !== "object") throw new Error("Fichier JSON invalide");
  if (json.app === "master-living-dex") {
    let vault;
    if (json.vault?.banks?.length) {
      let banks = json.vault.banks.map((b) => ({ ...b, kind: b.kind ?? "hack" }));
      if (!banks.some((b) => b.kind === "official")) banks = [newBank("Jeux officiels", "official"), ...banks];
      vault = { ...json.vault, banks, hacks: fixHacks(json.vault.hacks) };
    }
    else if (json.bank && Array.isArray(json.bank.mons)) {
      const b = { id: uid(), name: "ROM hacks", kind: "hack", boxes: json.bank.boxes?.length ? json.bank.boxes : newBank().boxes, mons: json.bank.mons };
      vault = { banks: [newBank("Jeux officiels", "official"), b], active: b.id, hacks: fixHacks(json.bank.hacks) };
    } else vault = defaultVault();
    if (!vault.banks.some((b) => b.id === vault.active)) vault.active = vault.banks[0].id;
    const bank = { mons: vault.banks.flatMap((b) => b.mons) };
    set("dex", json.dex ?? {});
    set("vault", vault);
    set("targets", json.targets ?? {});
    if (json.shinyGoal) setPref("shinyGoal", json.shinyGoal);
    return { dex: Object.keys(json.dex ?? {}).length, bank: bank.mons.length };
  }
  // ancien format : { "25": { "yellow": {caught,...} } }
  const keys = Object.keys(json);
  if (keys.length && !keys.every((k) => /^\d+$/.test(k))) throw new Error("Ce fichier n'est pas une sauvegarde Master Living Dex");
  set("dex", json);
  return { dex: keys.length, bank: null };
}

export function resetAll() {
  set("dex", {});
  set("targets", {});
  set("vault", defaultVault());
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}
export const resetDex = () => { set("dex", {}); set("targets", {}); };
export const resetBank = () => set("vault", defaultVault());
