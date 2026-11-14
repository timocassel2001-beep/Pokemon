import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuArrowDown, LuArrowLeft, LuArrowUp, LuChevronLeft, LuChevronRight, LuCopy, LuDownload, LuFileDown, LuFileUp,
  LuFolderPlus, LuGrid3X3, LuHardDrive, LuInfo, LuMove, LuPencil, LuPlus, LuSave, LuSearch, LuSettings, LuTrash2,
  LuTriangleAlert, LuX, LuRefreshCw, LuScanSearch,
} from "react-icons/lu";
import {
  BOX_SIZE, addBox, addBoxes, addMonAt, addMons, createBank, deleteBank, deleteBox, deleteMon, getState, moveBox, moveMon,
  renameBank, renameBox, saveHacks, sendToBank, setPref, switchBank, syncDex, updateMon, useStore,
} from "../lib/store.js";
import { BALLS, NATURES, ORIGIN_GAMES, STAT_LABELS, b64ToBytes, shinyValue } from "../lib/pkm.js";
import { monBlob, monFileName, readPokemonFiles, recordFromParsed, zipMons } from "../lib/bank.js";
import { normName, openSave, saveBlob, writeToSave } from "../lib/savefile.js";
import { loadMoveAbilityNames } from "../data/pokedata.js";
import { PLATFORMS, PLATFORM_IDS, HACK_PLATFORM_IDS, platformOf } from "../data/platforms.js";
import { OFFICIAL_BY_FORMAT, OFFICIAL_BY_GEN, formatGen, gameName, guessOfficial } from "../data/officialSources.js";
import { hackGameId } from "../data/hackGames.js";
import { takePendingSave } from "../lib/pending.js";
import { Btn, Card, Confirm, Field, Modal, ShinyStar, Sprite, cx, downloadBlob, inputCls, pad, useData } from "../components/ui.jsx";
import MonEditor from "../components/MonEditor.jsx";
import TransferDialog, { transferPatch } from "../components/TransferDialog.jsx";
import { SpeciesEvolutions } from "../components/GameGuide.jsx";
import { OFFICIAL_META, evaluateTransfer } from "../lib/officialTransfer.js";
import { applyTransfers } from "../lib/store.js";

function useMoveNames() {
  const [names, setNames] = useState(null);
  useEffect(() => {
    let alive = true;
    loadMoveAbilityNames().then((n) => alive && setNames(n)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return names;
}

const GAME_NAMES = Object.fromEntries(Object.keys(OFFICIAL_META).map((id) => [id, gameName(id)]));

// Charge utile du glisser-déposer (partagée entre les deux panneaux)
let dragPayload = null;

// ------------------------------------------------------------------ Emplacement
function Slot({ mon, selected, target, onClick, onDragStart, onDrop, badge, dim, title }) {
  const [over, setOver] = useState(false);
  return (
    <button
      onClick={onClick}
      draggable={!!mon && !!onDragStart}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "copyMove"; e.dataTransfer.setData("text/plain", "mld"); onDragStart?.(); }}
      onDragEnd={() => { dragPayload = null; }}
      onDragOver={(e) => { if (onDrop && dragPayload) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); if (dragPayload) onDrop?.(dragPayload); }}
      className={cx(
        "relative aspect-square rounded-xl border transition",
        mon ? "border-zinc-700 bg-zinc-900 hover:border-zinc-400" : "border-dashed border-zinc-800 bg-zinc-950/40 hover:border-zinc-600",
        mon && onDragStart && "cursor-grab active:cursor-grabbing",
        selected && "!border-emerald-400 ring-2 ring-emerald-400/50",
        target && !mon && "!border-sky-500/70 bg-sky-500/5",
        over && "!border-sky-400 !bg-sky-500/20 ring-2 ring-sky-400/50",
        dim && "opacity-40",
      )}
      title={title ?? (mon ? "" : "Emplacement libre")}
    >
      {mon && (
        <>
          <Sprite id={mon.species} shiny={mon.shiny} size={64} className="pointer-events-none mx-auto h-full max-h-20 w-full max-w-20 object-contain" />
          {mon.shiny && <ShinyStar className="absolute right-1 top-1 h-3.5 w-3.5" />}
          {mon.level ? <span className="absolute bottom-0.5 left-1 text-[10px] tabular-nums text-zinc-500">N.{mon.level}</span> : null}
          {(mon.checksumOk === false || !mon.species) && <LuTriangleAlert className="absolute left-1 top-1 h-3.5 w-3.5 text-amber-400" />}
          {badge && <span className="absolute bottom-0.5 right-1 rounded bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-300">{badge}</span>}
        </>
      )}
    </button>
  );
}

// ------------------------------------------------------------------ Fiche
function MonDetail({ mon, hackLabel, location, actions }) {
  const { byId } = useData();
  const [showEvo, setShowEvo] = useState(false);
  const names = useMoveNames();
  const sp = mon.species ? byId[mon.species] : null;
  const P = platformOf(mon.platform);
  const gb = P.gen <= 2;
  const moves = mon.moves
    ? mon.moves.filter(Boolean).map((id) => names?.moves?.[id] ?? `Attaque #${id}`)
    : (mon.movesText ?? []).filter(Boolean);
  const ability = mon.abilityId
    ? `${names?.abilities?.[mon.abilityId] ?? `Talent #${mon.abilityId}`}${mon.hiddenAbility ? " (caché)" : ""}`
    : mon.abilitySlot != null ? `Talent ${mon.abilitySlot + 1} de l'espèce` : mon.abilityText;
  const item = mon.item ? `Objet n°${mon.item}` : mon.itemText;
  const genderSym = { M: "♂", F: "♀" }[mon.gender] ?? "";
  const ivMax = mon.ivMax ?? (gb ? 15 : 31);
  const statIdx = gb ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4, 5];
  const statLabel = (i) => (gb && i === 3 ? "Spécial" : STAT_LABELS[i]);

  const Row = ({ k, v }) => (v || v === 0 ? (
    <div className="flex justify-between gap-3 border-b border-zinc-800/60 py-1.5 text-sm last:border-0">
      <span className="text-zinc-500">{k}</span>
      <span className="text-right text-zinc-200">{v}</span>
    </div>
  ) : null);

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="relative rounded-2xl bg-zinc-950 p-1">
          <Sprite id={mon.species} shiny={mon.shiny} size={96} />
          {mon.shiny && <ShinyStar className="absolute right-1.5 top-1.5 h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold text-zinc-50">
            {mon.nickname || sp?.fr || "Espèce inconnue"} <span className={mon.gender === "F" ? "text-pink-400" : "text-sky-400"}>{genderSym}</span>
          </div>
          <div className="text-sm text-zinc-400">{sp ? `${sp.fr} · #${pad(sp.id)}` : `Index interne #${mon.internalSpecies ?? "?"}`}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-semibold", P.cls)}>{P.label}</span>
            {mon.level ? <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">N.{mon.level}</span> : null}
            {mon.isEgg && <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">Œuf</span>}
            {mon.fateful && <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] text-fuchsia-300">Rencontre fatidique</span>}
            {mon.source === "manual" && <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">Saisie manuelle</span>}
          </div>
        </div>
      </div>

      {mon.checksumOk === false && (
        <div className="mt-3 flex gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-200"><LuTriangleAlert className="h-4 w-4 shrink-0" /> Données incohérentes (checksum ou espèce) : infos peut-être fausses, mais les octets d'origine sont conservés tels quels.</div>
      )}
      {mon.species && mon.species > P.max && (
        <div className="mt-3 flex gap-2 rounded-lg bg-sky-500/10 p-2 text-xs text-sky-200"><LuInfo className="h-4 w-4 shrink-0" /> Espèce hors Pokédex {P.label} : ne pourra aller que dans un hack à Pokédex étendu.</div>
      )}
      {mon.shinyByHack && <p className="mt-2 text-[11px] text-amber-200/80">Shiny selon la règle de ce hack (seuil shiny élargi) : il ne le sera pas forcément dans un jeu qui suit la règle d'origine.</p>}
      {gb && mon.shiny && !mon.shinyByHack && <p className="mt-2 text-[11px] text-amber-200/80">{P.gen === 1 ? "Chromatique une fois transféré en Gen 2 (IV compatibles)." : "Chromatique (IV Gen 2)."}</p>}

      <div className="mt-4">
        <Row k="Origine du Pokémon" v={hackLabel} />
        <Row k="Emplacement" v={location} />
        <Row k="Nature" v={mon.nature != null ? NATURES[mon.nature] : null} />
        <Row k="Talent" v={ability} />
        <Row k="Objet" v={item} />
        <Row k="Ball" v={mon.ball ? BALLS[mon.ball] ?? `Ball n°${mon.ball}` : null} />
        <Row k="Dresseur" v={mon.ot || mon.tid != null ? `${mon.ot || "?"}${mon.tid != null && mon.tid !== "" ? ` · ID ${String(mon.tid).padStart(5, "0")}` : ""}` : null} />
        <Row k="Origine" v={mon.originGame ? `${ORIGIN_GAMES[mon.originGame] ?? `Version ${mon.originGame}`}${mon.metLevel ? ` · rencontré N.${mon.metLevel}` : ""}` : null} />
        <Row k="Fichier" v={mon.fileName ? <span className="break-all text-xs">{mon.fileName}</span> : null} />
      </div>

      {moves.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {moves.map((m, i) => <div key={i} className="truncate rounded-lg bg-zinc-950 px-2 py-1.5 text-center text-xs text-zinc-200">{m}</div>)}
        </div>
      )}

      {mon.ivs?.some((v) => v != null) && (
        <div className="mt-4 space-y-1">
          <div className="text-xs font-medium text-zinc-400">{gb ? "DV (0–15)" : "IV"}{mon.evs ? (gb ? " / Stat Exp" : " / EV") : ""}</div>
          {statIdx.map((i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-14 text-zinc-500">{statLabel(i)}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div className={cx("h-full rounded-full", mon.ivs[i] === ivMax ? "bg-emerald-400" : "bg-zinc-400")} style={{ width: `${((mon.ivs[i] ?? 0) / ivMax) * 100}%` }} />
              </div>
              <span className="w-6 text-right tabular-nums text-zinc-200">{mon.ivs[i] ?? "–"}</span>
              {mon.evs && <span className="w-10 text-right tabular-nums text-zinc-500">{mon.evs[i]}</span>}
            </div>
          ))}
        </div>
      )}

      {mon.game && OFFICIAL_META[mon.game] && Number(String(mon.source).replace(/\D/g, "")) !== OFFICIAL_META[mon.game].gen && mon.source !== "manual" && (
        <p className="mt-3 flex gap-2 rounded-lg bg-sky-500/10 p-2 text-[11px] text-sky-200"><LuInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />Transféré pour le suivi : ses données d'origine (format .{mon.source}) sont conservées ; la conversion se fait avec les applications officielles.</p>
      )}
      {mon.game && OFFICIAL_META[mon.game] && mon.species && (
        <div className="mt-3 rounded-lg bg-zinc-950 p-2">
          <button className="text-[11px] font-medium text-violet-300 hover:text-violet-200" onClick={() => setShowEvo(!showEvo)}>
            {showEvo ? "▾" : "▸"} Évolutions dans {GAME_NAMES[mon.game]}
          </button>
          {showEvo && <div className="mt-1"><SpeciesEvolutions species={mon.species} game={mon.game} /></div>}
        </div>
      )}
      {mon.history?.length > 0 && (
        <div className="mt-3 rounded-lg bg-zinc-950 p-2 text-[11px] text-zinc-400">
          <div className="mb-1 font-medium text-zinc-300">Historique des transferts</div>
          {mon.history.map((h, i) => <div key={i}>{GAME_NAMES[h.from] ?? h.from ?? "?"} → {GAME_NAMES[h.to] ?? h.to}{h.via ? ` (${h.via})` : ""}</div>)}
        </div>
      )}
      {mon.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-zinc-950 p-2 text-xs text-zinc-300">{mon.notes}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">{actions}</div>
    </div>
  );
}

// ------------------------------------------------------------------ Import de fichiers
function ImportDialog({ results, hacks, kind, onCancel, onConfirm }) {
  const { byId } = useData();
  const official = kind === "official";
  // en banque ROM hacks, les formats 3DS / Switch (officiels uniquement) sont refusés
  const res = results.map((r) => (r.ok && !official && !HACK_PLATFORM_IDS.includes(r.mon.platform) ? { ...r, ok: false, error: "Format de jeu officiel : à importer dans une banque « Jeux officiels »" } : r));
  const okOnes = res.filter((r) => r.ok);
  const groups = official ? [...new Set(okOnes.map((r) => r.mon.source))] : [...new Set(okOnes.map((r) => r.mon.platform))];
  const [choice, setChoice] = useState(() =>
    Object.fromEntries(groups.map((g) => [g, official ? (OFFICIAL_BY_FORMAT[g] ?? [])[0] : hacks.find((h) => h.platform === g)?.id ?? hacks[0]?.id])));
  return (
    <Modal open onClose={onCancel} wide title={`Importer ${results.length} fichier(s)`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <Field key={g} label={official ? `Les fichiers .${g} viennent du jeu :` : `Les Pokémon ${platformOf(g).label} viennent de :`} className={groups.length === 1 ? "sm:col-span-2" : ""}>
            {official ? (
              <select className={inputCls} value={choice[g] ?? ""} onChange={(e) => setChoice({ ...choice, [g]: e.target.value })}>
                {(OFFICIAL_BY_FORMAT[g] ?? []).map((id) => <option key={id} value={id}>{gameName(id)}</option>)}
              </select>
            ) : (
              <HackSelect hacks={hacks} platform={g} value={choice[g]} onChange={(v) => setChoice({ ...choice, [g]: v })} />
            )}
          </Field>
        ))}
      </div>
      <div className="mt-4 max-h-80 space-y-1 overflow-y-auto">
        {res.map((r, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-zinc-950 px-2 py-1.5 text-sm">
            {r.ok ? <Sprite id={r.mon.species} shiny={r.mon.shiny} size={36} /> : <div className="grid h-9 w-9 place-items-center text-red-400"><LuTriangleAlert className="h-4 w-4" /></div>}
            <div className="min-w-0 flex-1">
              <div className="truncate text-zinc-200">
                {r.ok ? `${r.mon.nickname || byId[r.mon.species]?.fr || "Espèce inconnue"}${r.mon.level ? ` · N.${r.mon.level}` : ""}` : r.name}
                {r.ok && r.mon.shiny && <span className="ml-1 text-amber-300">★</span>}
              </div>
              <div className={cx("truncate text-xs", r.ok ? (r.warn ? "text-amber-300" : "text-zinc-500") : "text-red-400")}>
                {r.ok ? r.warn ?? `${r.name} · ${r.mon.source.toUpperCase()}` : r.error}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Btn onClick={onCancel}>Annuler</Btn>
        <Btn variant="primary" disabled={!okOnes.length} onClick={() => onConfirm(okOnes.map((r) => (official ? { ...r.mon, game: choice[r.mon.source], hack: null } : { ...r.mon, hack: choice[r.mon.platform], game: null })))}>
          Ajouter {okOnes.length} Pokémon à la banque
        </Btn>
      </div>
    </Modal>
  );
}

/** Synchronise le Pokédex d'un jeu (officiel ou hack) avec le contenu d'une sauvegarde. */
function SyncDialog({ records, target, onClose, toast }) {
  const { byId } = useData();
  const [replace, setReplace] = useState(false);
  const [quotas, setQuotas] = useState(true);
  const counts = useMemo(() => {
    const c = {};
    for (const r of records) {
      if (!r || !r.species || r.isEgg) continue;
      const k = (c[r.species] ??= { normal: 0, shiny: 0 });
      if (r.shiny) k.shiny++; else k.normal++;
    }
    return c;
  }, [records]);
  const n = Object.keys(counts).length;
  const nShiny = Object.values(counts).filter((x) => x.shiny).length;
  const dups = Object.values(counts).reduce((a, x) => a + Math.max(0, x.normal - 1) + Math.max(0, x.shiny - 1), 0);
  return (
    <Modal open onClose={onClose} title={`Synchroniser le Dex · ${target.name}`}>
      <p className="text-sm text-zinc-300">Cette sauvegarde contient <b>{n}</b> espèce(s), dont <b>{nShiny}</b> en shiny, et <b>{dups}</b> doublon(s).</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {Object.keys(counts).slice(0, 40).map((sid) => <Sprite key={sid} id={Number(sid)} shiny={counts[sid].shiny > 0} size={32} />)}
        {n > 40 && <span className="self-center text-xs text-zinc-500">+{n - 40}</span>}
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm text-zinc-300">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-500" checked={quotas} onChange={(e) => setQuotas(e.target.checked)} />
        <span>Compter les doublons comme <b>quota de transfert</b> (exemplaires en plus à envoyer vers d'autres jeux)</span>
      </label>
      <label className="mt-2 flex items-start gap-2 text-sm text-zinc-300">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-500" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
        <span><b>Remplacer</b> : décocher dans ce jeu les espèces qui ne sont plus dans la sauvegarde (sinon on ne fait qu'ajouter)</span>
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Btn onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" onClick={() => { const c = syncDex(target.gid, counts, { replace, quotas }); toast(`Dex « ${target.name} » synchronisé : ${c} fiche(s) mise(s) à jour`); onClose(); }}>
          <LuRefreshCw className="h-4 w-4" /> Synchroniser
        </Btn>
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">Ce n'est pas une identification « au Pokémon près » : le Dex garde une case par espèce et par jeu. {byId ? "" : ""}</p>
    </Modal>
  );
}

function HackSelect({ hacks, platform, value, onChange, className = "" }) {
  const sorted = [...hacks].sort((a, b) => (a.platform === platform ? 0 : 1) - (b.platform === platform ? 0 : 1));
  return (
    <select className={cx(inputCls, className)} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {sorted.map((h) => <option key={h.id} value={h.id}>{h.name} — {platformOf(h.platform).short}</option>)}
    </select>
  );
}

// ------------------------------------------------------------------ Hacks
function HackManager({ hacks, mons, onClose }) {
  const [list, setList] = useState(hacks.map((h) => ({ ...h })));
  const used = new Set(mons.map((m) => m.hack));
  const upd = (i, k, v) => setList(list.map((h, j) => (j === i ? { ...h, [k]: v } : h)));
  return (
    <Modal open onClose={onClose} wide title="Mes ROM hacks">
      <p className="mb-3 text-sm text-zinc-400">La plateforme détermine le format des Pokémon et le Pokédex de référence (151, 251, 386, 493 ou 649 espèces). La colonne ★ est la chance de shiny du hack (1/8192 dans les jeux d'origine, 1/4 pour Cœur d'Or Ultra). « Dex » = Pokédex du hack, utilisé pour son suivi dans Pokédex par jeu.</p>
      <div className="space-y-2">
        {list.map((h, i) => (
          <div key={h.id} className="grid grid-cols-12 gap-2">
            <input className={cx(inputCls, "col-span-3")} value={h.name} onChange={(e) => upd(i, "name", e.target.value)} placeholder="Nom du hack" />
            <select className={cx(inputCls, "col-span-2")} value={h.platform} onChange={(e) => upd(i, "platform", e.target.value)}>
              {HACK_PLATFORM_IDS.map((p) => <option key={p} value={p}>{PLATFORMS[p].label}</option>)}
            </select>
            <input className={cx(inputCls, "col-span-2")} value={h.base} onChange={(e) => upd(i, "base", e.target.value)} placeholder="Jeu de base" />
            <select className={cx(inputCls, "col-span-2 !px-1 text-xs")} value={h.dexMax ?? platformOf(h.platform).max} onChange={(e) => upd(i, "dexMax", Number(e.target.value))} title="Pokédex du hack (pour son Dex)">
              {[[151, "Dex 1 gén."], [251, "Dex 2 gén."], [386, "Dex 3 gén."], [493, "Dex 4 gén."], [649, "Dex 5 gén."], [721, "Dex 6 gén."], [809, "Dex 7 gén."], [905, "Dex 8 gén."], [1025, "Dex 1025"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className={cx(inputCls, "col-span-2 !px-1 text-xs")} value={h.shinyThreshold ?? 8} onChange={(e) => upd(i, "shinyThreshold", Number(e.target.value))} title="Règle shiny du hack">
              <option value={8}>★ 1/8192</option>
              <option value={16}>★ 1/4096</option>
              <option value={64}>★ 1/1024</option>
              <option value={512}>★ 1/128</option>
              <option value={16384}>★ 1/4</option>
            </select>
            <button disabled={used.has(h.id) || list.length <= 1} onClick={() => setList(list.filter((_, j) => j !== i))} className="col-span-1 grid place-items-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-20" title={used.has(h.id) ? "Utilisé par des Pokémon" : "Supprimer"}>
              <LuTrash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between gap-2">
        <Btn onClick={() => setList([...list, { id: Math.random().toString(36).slice(2, 10), name: "", platform: "gba", base: PLATFORMS.gba.base }])}><LuPlus className="h-4 w-4" /> Ajouter un hack</Btn>
        <div className="flex gap-2">
          <Btn onClick={onClose}>Annuler</Btn>
          <Btn variant="primary" onClick={() => { saveHacks(list.map((h) => ({ ...h, name: h.name.trim() || "Sans nom" }))); onClose(); }}>Enregistrer</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Vue d'ensemble des boîtes
function BoxOverview({ boxes, mons, current, onOpen, onClose, toast }) {
  const { byId } = useData();
  const byBox = useMemo(() => {
    const m = {};
    for (const x of mons) (m[x.box] ??= []).push(x);
    return m;
  }, [mons]);
  return (
    <Modal open onClose={onClose} wide title={`Toutes les boîtes (${boxes.length})`}>
      <div className="mb-3 flex flex-wrap gap-2">
        <Btn onClick={() => addBox()}><LuFolderPlus className="h-4 w-4" /> 1 boîte</Btn>
        <Btn onClick={() => addBoxes(10)}><LuFolderPlus className="h-4 w-4" /> 10 boîtes</Btn>
        <span className="self-center text-xs text-zinc-500">Nombre de boîtes illimité (30 places chacune).</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {boxes.map((b, i) => {
          const list = (byBox[b.id] ?? []).sort((a, c) => a.slot - c.slot);
          return (
            <div key={b.id} className={cx("rounded-xl border bg-zinc-950 p-2", i === current ? "border-emerald-500/60" : "border-zinc-800")}>
              <button onClick={() => onOpen(i)} className="w-full text-left">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-zinc-100">{b.name}</span>
                  <span className="text-xs tabular-nums text-zinc-500">{list.length}/{BOX_SIZE}</span>
                </div>
                <div className="mt-1 flex h-8 flex-wrap gap-0.5 overflow-hidden">
                  {list.slice(0, 10).map((m) => <Sprite key={m.id} id={m.species} shiny={m.shiny} size={30} />)}
                  {!list.length && <span className="text-xs text-zinc-600">vide</span>}
                </div>
              </button>
              <div className="mt-1 flex justify-end gap-0.5">
                <button className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white" onClick={() => moveBox(b.id, -1)} title="Monter"><LuArrowUp className="h-3.5 w-3.5" /></button>
                <button className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white" onClick={() => moveBox(b.id, 1)} title="Descendre"><LuArrowDown className="h-3.5 w-3.5" /></button>
                <button className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400" onClick={() => toast(deleteBox(b.id) ? "Boîte supprimée" : "Seule une boîte vide peut être supprimée")} title="Supprimer (si vide)"><LuTrash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ Vue principale
export default function Bank({ toast }) {
  const { byId, gameDex } = useData();
  const bank = useStore((s) => s.bank);
  const vault = useStore((s) => s.vault);
  const prefs = useStore((s) => s.prefs);
  const { boxes, mons, hacks } = bank;
  const boxIdx = Math.min(Math.max(0, prefs.bankBox ?? 0), boxes.length - 1);
  const [bankDialog, setBankDialog] = useState(null); // { mode: "new" | "rename" | "delete" }
  const box = boxes[boxIdx];
  const setBox = (i) => { const n = getState().bank.boxes.length; setPref("bankBox", ((i % n) + n) % n); };

  // Shiny selon la règle du hack : certains hacks (ex. Cœur d'Or Ultra) ont un seuil plus large que 8
  const hackById = useMemo(() => Object.fromEntries(hacks.map((h) => [h.id, h])), [hacks]);
  const eff = (m, hackId) => {
    if (!m || m.shiny) return m;
    const t = hackById[hackId ?? m.hack]?.shinyThreshold;
    const v = shinyValue(m.pid, m.tid, m.sid);
    return t > 8 && v != null && v < t ? { ...m, shiny: true, shinyByHack: true } : m;
  };

  const [sel, setSel] = useState(null); // { kind: "bank", id } | { kind: "save", box, slot } | { kind: "party", i }
  const [moving, setMoving] = useState(null);
  const [sending, setSending] = useState(null); // id d'un Pokémon de la Banque à écrire dans la sauvegarde
  const [editor, setEditor] = useState(null);
  const [importRes, setImportRes] = useState(null);
  const [hackMgr, setHackMgr] = useState(false);
  const [overview, setOverview] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [q, setQ] = useState("");
  const [hackFilter, setHackFilter] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const saveRef = useRef(null);

  // ---- sauvegarde de hack ouverte
  const [save, setSave] = useState(null);
  const [saveBoxIdx, setSaveBoxIdx] = useState(0);
  const [saveHack, setSaveHack] = useState(null);
  const [saveGame, setSaveGame] = useState(null);
  const [originConfirm, setOriginConfirm] = useState(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [transferList, setTransferList] = useState(null);
  const [bankTab, setBankTab] = useState("boxes");
  const isOfficial = bank.kind === "official";
  const savePlatform = save?.platform;

  const saveRecords = useMemo(() => {
    if (!save) return null;
    const conv = (p) => (p ? eff(recordFromParsed({ ...p }, byId).mon, saveHack) : null);
    return { boxes: save.boxes.map((b) => b.slots.map(conv)), party: save.party.map(conv) };
  }, [save, byId, saveHack, hackById]); // eslint-disable-line
  const bankRaws = useMemo(() => new Set(mons.map((m) => m.raw).filter(Boolean)), [mons]);

  const slots = useMemo(() => {
    const arr = Array(BOX_SIZE).fill(null);
    for (const m of mons) if (m.box === box.id && m.slot < BOX_SIZE) arr[m.slot] = eff(m);
    return arr;
  }, [mons, box.id, hackById]); // eslint-disable-line

  const selMon =
    sel?.kind === "bank" ? eff(mons.find((m) => m.id === sel.id)) ?? null
    : sel?.kind === "save" ? saveRecords?.boxes[sel.box]?.[sel.slot] ?? null
    : sel?.kind === "party" ? saveRecords?.party[sel.i] ?? null
    : null;

  const search = useMemo(() => {
    if (!q.trim() && !hackFilter) return null;
    const n = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return mons.filter((m) => {
      if (hackFilter && m.hack !== hackFilter) return false;
      if (!n) return true;
      if (n === "shiny") return eff(m).shiny;
      const sp = byId[m.species];
      const hay = `${sp?.fr ?? ""} ${sp?.en ?? ""} ${m.nickname ?? ""} ${m.ot ?? ""} ${m.notes ?? ""} ${m.species ?? ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      return hay.includes(n);
    });
  }, [q, hackFilter, mons, byId]);

  const hackName = (id) => { const h = hacks.find((x) => x.id === id); return h ? `${h.name} (base ${h.base})` : "—"; };
  const originLabel = (m) => (m.game ? `${gameName(m.game)} (jeu officiel)` : hackName(m.hack));
  const norm = (x) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const defaultHackFor = (platform, fileName = "") => {
    const words = new Set(norm(fileName));
    const scored = hacks
      .filter((h) => h.platform === platform)
      .map((h) => ({ h, score: norm(h.name).filter((w) => words.has(w)).length }))
      .sort((a, b) => b.score - a.score);
    return scored[0]?.h.id ?? hacks[0]?.id;
  };

  // ---- fichiers
  const onFiles = async (files) => {
    if (!files?.length) return;
    const list = [...files];
    const isPk = (f) => /\.(pk[1-9]|ek[3-9]|pb8|pa8|pb7|pkm|zip)$/i.test(f.name);
    const saves = list.filter((f) => !isPk(f) && f.size >= 0x8000);
    const others = list.filter((f) => !saves.includes(f));
    if (saves[0]) await onSaveFile(saves[0]);
    if (others.length) setImportRes(await readPokemonFiles(others, byId));
  };

  const namesIndex = useMemo(() => {
    const idToNames = {}, nameToId = {};
    for (const sp of Object.values(byId)) {
      const ns = [normName(sp.fr), normName(sp.en)];
      idToNames[sp.id] = ns;
      for (const n of ns) { if (n && nameToId[n] == null) nameToId[n] = sp.id; if (n.length > 10 && nameToId[n.slice(0, 10)] == null) nameToId[n.slice(0, 10)] = sp.id; }
    }
    return { idToNames, nameToId };
  }, [byId]);

  const useSave = (s, fileName) => {
    setSave(s);
    setSaveBoxIdx(0);
    setSaveHack(defaultHackFor(s.platform, fileName));
    setSaveGame(guessOfficial(s.gen, s.game, fileName));
    setSel(null);
    // les sauvegardes 3DS sont forcément des jeux officiels
    if (!HACK_PLATFORM_IDS.includes(s.platform) && bank.kind !== "official") {
      const off = vault.banks.find((b) => b.kind === "official");
      if (off) { switchBank(off.id); setPref("bankBox", 0); toast(`Sauvegarde de jeu officiel : banque « ${off.name} » ouverte`); }
    }
  };
  useEffect(() => {
    const p = takePendingSave();
    if (p) { useSave(p.save, p.save.fileName); toast(`Résultat de l'analyse ouvert : ${p.label}`); }
  }, []); // eslint-disable-line

  const onSaveFile = async (file) => {
    try {
      const s = openSave(file.name, await file.arrayBuffer(), { names: namesIndex });
      useSave(s, file.name);
      const n = s.boxes.reduce((a, b) => a + b.slots.filter(Boolean).length, 0) + s.party.length;
      toast(`Sauvegarde ${s.game} ouverte : ${n} Pokémon trouvés`);
    } catch (e) {
      toast(`Sauvegarde illisible : ${e.message}`);
    }
  };

  // ---- actions
  const copyToBank = (records, targetBox = box.id, targetSlot = null) => {
    if (!isOfficial && save && !HACK_PLATFORM_IDS.includes(save.platform)) return toast("Cette sauvegarde est un jeu officiel : ouvre une banque « Jeux officiels ».");
    const origin = isOfficial ? { game: saveGame, hack: null } : { hack: saveHack, game: null };
    const fresh = records
      .filter((r) => r && !bankRaws.has(r.raw))
      .map(({ shinyByHack, ...r }) => ({ ...r, shiny: shinyByHack ? false : r.shiny, ...origin, fileName: save?.fileName ?? null }));
    const skipped = records.filter(Boolean).length - fresh.length;
    if (!fresh.length) return toast(skipped ? "Déjà présent(s) dans la Banque" : "Rien à copier");
    let placed;
    if (targetSlot != null && fresh.length === 1) placed = [addMonAt(fresh[0], targetBox, targetSlot)];
    else placed = addMons(fresh, targetBox);
    toast(`${placed.length} Pokémon copié(s) dans la Banque${skipped ? ` (${skipped} déjà présent(s))` : ""}`);
    return placed;
  };

  const writeMonToSave = (bankMonId, sBox, sSlot, confirmed = false) => {
    let m = getState().bank.mons.find((x) => x.id === bankMonId);
    if (!m) return;
    if (!m.raw) return toast("Un Pokémon saisi à la main n'a pas de données de jeu à écrire.");
    if (isOfficial) {
      // Jeux officiels : on applique les règles de transfert des vrais jeux
      const r = evaluateTransfer(m, saveGame, { gameDex, byId });
      if (r.status === "impossible") return toast(`Indisponible : ${r.reason}`);
      if (r.status === "track") return toast(`Ce transfert passe par ${r.steps.map((x) => x.label).join(" → ")} : il se fait avec les applications officielles, l'application ne peut pas écrire un Pokémon de format .${m.source} dans cette sauvegarde.`);
      if (r.status === "file" || r.status === "convert") {
        const patch = transferPatch(m, saveGame, r.status, byId);
        const data = patch ? { ...m, ...patch } : m;
        try {
          const next = writeToSave(save, sBox, sSlot, b64ToBytes(data.raw), data.source);
          setSave(next);
          setSending(null);
          applyTransfers([{ id: m.id, to: saveGame, patch, via: r.steps.map((x) => x.label).join(" → ") }], { dexUpdate: true });
          toast(`${m.nickname || byId[m.species]?.fr} transféré dans ${gameName(saveGame)} — pense à télécharger la sauvegarde`);
        } catch (e) { toast(e.message); }
        return;
      }
      confirmed = true; // même jeu : écriture directe
    }
    if (formatGen(m.source) !== save.gen) return toast(`Ce Pokémon (format .${m.source}) ne peut pas aller dans une sauvegarde Gen ${save.gen}.`);
    if (!confirmed) {
      // retour au jeu d'origine : on prévient si la destination n'est pas le jeu / hack d'où il vient
      const from = m.hack ? hacks.find((h) => h.id === m.hack)?.name : m.game ? gameName(m.game) : null;
      const to = isOfficial ? gameName(saveGame) : hacks.find((h) => h.id === saveHack)?.name;
      const sameOrigin = isOfficial ? m.game === saveGame : m.hack === saveHack;
      const numbering = m.speciesMode && save.speciesMode && m.speciesMode !== save.speciesMode;
      if (!sameOrigin || numbering) {
        setOriginConfirm({
          monId: bankMonId, sBox, sSlot,
          message: `${m.nickname || byId[m.species]?.fr} vient de « ${from ?? "origine inconnue"} » et la sauvegarde est « ${to ?? "?"} ».`
            + (numbering ? " ATTENTION : ces deux jeux ne numérotent pas les espèces de la même façon, le Pokémon risque d'apparaître comme une autre espèce." : " Si les deux jeux ont la même base et le même Pokédex, ça fonctionne ; sinon le Pokémon peut être illisible dans le jeu."),
        });
        return;
      }
    }
    try {
      const next = writeToSave(save, sBox, sSlot, b64ToBytes(m.raw), m.source);
      setSave(next);
      setSending(null);
      toast(`${m.nickname || byId[m.species]?.fr} écrit dans la sauvegarde — pense à la télécharger`);
    } catch (e) {
      toast(e.message);
    }
  };

  const onBankDrop = (slotIdx) => (payload) => {
    if (payload.src === "bank") { moveMon(payload.id, box.id, slotIdx); toast("Pokémon déplacé"); }
    else if (payload.src === "save") {
      const rec = payload.party != null ? saveRecords.party[payload.party] : saveRecords.boxes[payload.box][payload.slot];
      copyToBank([rec], box.id, slotIdx);
    }
  };
  const onSaveDrop = (sBox, sSlot) => (payload) => {
    if (payload.src === "bank") writeMonToSave(payload.id, sBox, sSlot);
  };

  const clickBankSlot = (i) => {
    const m = slots[i];
    if (moving) { moveMon(moving, box.id, i); setMoving(null); setSel({ kind: "bank", id: moving }); toast("Pokémon déplacé"); return; }
    setSending(null);
    setSel(m ? { kind: "bank", id: m.id } : null);
  };
  const clickSaveSlot = (sBox, sSlot) => {
    const p = saveRecords.boxes[sBox][sSlot];
    if (sending && !p) return writeMonToSave(sending, sBox, sSlot);
    setSending(null); setMoving(null);
    setSel(p ? { kind: "save", box: sBox, slot: sSlot } : null);
  };

  const exportZip = async (list, name) => {
    if (!list.length) return toast("Rien à exporter");
    const blob = await zipMons(list, boxes, byId, hacks);
    downloadBlob(blob, name);
    toast(`${list.filter((m) => m.raw).length} fichier(s) exporté(s) + index.csv`);
  };

  const count = mons.length;
  const shinyCount = mons.filter((m) => eff(m).shiny).length;
  const saveBox = save?.boxes[saveBoxIdx];
  const saveCols = save && save.gen <= 2 ? 5 : 6;

  // ---- actions de la fiche
  let actions = null;
  if (selMon && sel.kind === "bank") {
    const canSend = save && save.writable && selMon.raw && (isOfficial ? ["same", "file", "convert"].includes(evaluateTransfer(selMon, saveGame, { gameDex, byId }).status) : formatGen(selMon.source) === save.gen);
    actions = (
      <>
        {selMon.raw && (
          <Btn variant="primary" className="col-span-2" onClick={() => downloadBlob(monBlob(selMon), monFileName(selMon, byId))}>
            <LuFileDown className="h-4 w-4" /> Télécharger le .{selMon.source}
          </Btn>
        )}
        {canSend && (
          <Btn className="col-span-2 !border-sky-500/50 !text-sky-300" onClick={() => { setSending(selMon.id); toast("Clique sur un emplacement libre de la sauvegarde"); }}>
            <LuArrowLeft className="h-4 w-4 rotate-180" /> Envoyer dans la sauvegarde
          </Btn>
        )}
        {isOfficial && (
          <Btn className="col-span-2 !border-violet-500/50 !text-violet-200" onClick={() => setTransferList([selMon])}>
            <LuArrowLeft className="h-4 w-4 rotate-180" /> Transférer vers un autre jeu…
          </Btn>
        )}
        <Btn onClick={() => setEditor({ mon: selMon })}><LuPencil className="h-4 w-4" /> Modifier</Btn>
        <Btn onClick={() => setMoving(selMon.id)}><LuMove className="h-4 w-4" /> Déplacer</Btn>
        {vault.banks.filter((b) => b.kind === bank.kind).length > 1 && (
          <select
            className={cx(inputCls, "col-span-2 !py-1.5 text-sm")}
            value=""
            onChange={(e) => { if (!e.target.value) return; const n = sendToBank([selMon.id], e.target.value); setSel(null); toast(n ? `Envoyé vers « ${vault.banks.find((b) => b.id === e.target.value)?.name} »` : "Rien n'a été envoyé"); }}
          >
            <option value="">Envoyer vers une autre banque…</option>
            {vault.banks.filter((b) => b.id !== vault.active && b.kind === bank.kind).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <Btn variant="subtle" className="col-span-2 !text-red-400 hover:!bg-red-500/10" onClick={() => setConfirmDel(selMon)}><LuTrash2 className="h-4 w-4" /> Retirer de la Banque</Btn>
      </>
    );
  } else if (selMon) {
    const already = bankRaws.has(selMon.raw);
    actions = (
      <>
        <Btn variant="primary" className="col-span-2" disabled={already} onClick={() => { const p = copyToBank([selMon]); if (p?.[0]) setSel({ kind: "bank", id: p[0].id }); }}>
          <LuCopy className="h-4 w-4" /> {already ? "Déjà dans la Banque" : "Copier dans la Banque"}
        </Btn>
        <Btn className="col-span-2" onClick={() => downloadBlob(monBlob(selMon), monFileName(selMon, byId))}><LuFileDown className="h-4 w-4" /> Télécharger le .{selMon.source}</Btn>
      </>
    );
  }
  const selLocation =
    sel?.kind === "bank" && selMon ? `${boxes.find((b) => b.id === selMon.box)?.name} · case ${selMon.slot + 1}`
    : sel?.kind === "save" ? `Sauvegarde · ${save.boxes[sel.box].name} · case ${sel.slot + 1}`
    : sel?.kind === "party" ? `Sauvegarde · équipe n°${sel.i + 1}` : null;

  return (
    <div
      onDragOver={(e) => { if (!dragPayload) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
      onDrop={(e) => { if (!dragPayload && e.dataTransfer.files?.length) { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); } else setDrag(false); }}
      className="relative"
    >
      {drag && <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-emerald-500/10 text-xl font-semibold text-emerald-300 ring-4 ring-inset ring-emerald-400/60">Dépose une sauvegarde (.sav) ou des fichiers .pk1 à .pk5</div>}

      <div className="mb-4 grid gap-2 md:grid-cols-2">
        {[["official", "Jeux officiels", "text-sky-300", "bg-sky-500/15 ring-sky-500/50 text-sky-200"], ["hack", "ROM hacks", "text-teal-300", "bg-teal-500/15 ring-teal-500/50 text-teal-200"]].map(([kind, label, tone, activeCls]) => (
          <div key={kind} className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2">
            <span className={cx("px-1 text-[10px] font-bold uppercase tracking-wide", tone)}>{label}</span>
            {vault.banks.filter((b) => b.kind === kind).map((b) => (
              <button
                key={b.id}
                onClick={() => { if (b.id !== vault.active) { switchBank(b.id); setPref("bankBox", 0); setSel(null); setMoving(null); setSending(null); } }}
                className={cx("rounded-xl px-3 py-1.5 text-sm transition", b.id === vault.active ? cx("font-semibold ring-1", activeCls) : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100")}
              >
                {b.name} <span className="text-xs tabular-nums opacity-70">({b.mons.length})</span>
              </button>
            ))}
            <button onClick={() => setBankDialog({ mode: "new", kind })} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white" title={`Nouvelle banque ${label}`}><LuPlus className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="mb-4 flex gap-1 border-b border-zinc-800">
        <span className="-mb-px border-b-2 border-emerald-400 px-3 py-2 text-sm text-zinc-100">Boîtes</span>
        <a href="#guide" className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300">Guide des jeux (évolutions, Pokémon à faire venir) →</a>
      </div>
      {(<>
      <div className="mb-3 flex flex-wrap gap-2">
        <Btn className="!px-2.5 !py-1.5 text-xs" onClick={() => setBankDialog({ mode: "rename" })}><LuPencil className="h-3.5 w-3.5" /> Renommer « {bank.name} »</Btn>
        {vault.banks.filter((b) => b.kind === bank.kind).length > 1 && <Btn className="!px-2.5 !py-1.5 text-xs !text-red-400" onClick={() => setBankDialog({ mode: "delete" })}><LuTrash2 className="h-3.5 w-3.5" /> Supprimer cette banque</Btn>}
        <a href="#analyseur" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"><LuScanSearch className="h-3.5 w-3.5" /> Analyser une sauvegarde inconnue</a>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400"><span className={cx("font-medium", isOfficial ? "text-sky-300" : "text-teal-300")}>{isOfficial ? "Jeux officiels" : "ROM hacks"} › {bank.name}</span> · {count} Pokémon · {shinyCount} shiny · {boxes.length} boîtes</p>
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" onClick={() => saveRef.current.click()}><LuHardDrive className="h-4 w-4" /> Ouvrir une sauvegarde</Btn>
          <input ref={saveRef} type="file" className="hidden" onChange={(e) => { if (e.target.files[0]) onSaveFile(e.target.files[0]); e.target.value = ""; }} />
          <Btn onClick={() => fileRef.current.click()}><LuFileUp className="h-4 w-4" /> Importer des .pk</Btn>
          <input ref={fileRef} type="file" multiple accept=".pk1,.pk2,.pk3,.ek3,.pk4,.ek4,.pk5,.ek5,.pk6,.ek6,.pk7,.ek7,.pk8,.ek8,.pb8,.pk9,.ek9,.pkm,.zip" className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          <Btn onClick={() => setEditor({})}><LuPlus className="h-4 w-4" /> Saisie manuelle</Btn>
          <Btn onClick={() => exportZip(mons, `${bank.name}.zip`)}><LuDownload className="h-4 w-4" /> Exporter la banque</Btn>
          <Btn onClick={() => setHackMgr(true)}><LuSettings className="h-4 w-4" /> Mes hacks</Btn>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input className={cx(inputCls, "pl-9")} placeholder="Chercher dans toute la Banque (espèce, surnom, dresseur, notes, « shiny »)…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={cx(inputCls, "w-auto")} value={hackFilter} onChange={(e) => setHackFilter(e.target.value)}>
          <option value="">Tous les hacks</option>
          {hacks.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </div>

      {search && (
        <Card className="mb-4 p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-zinc-300">{search.length} résultat(s)</span>
            <div className="flex gap-2">
              <Btn className="!py-1 text-xs" onClick={() => exportZip(search, "banque_selection.zip")} disabled={!search.length}><LuDownload className="h-3.5 w-3.5" /> Exporter ces résultats</Btn>
              <Btn className="!py-1 text-xs" onClick={() => { setQ(""); setHackFilter(""); }}>Effacer</Btn>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {search.slice(0, 120).map((m) => {
              const bi = boxes.findIndex((b) => b.id === m.box);
              return (
                <button key={m.id} onClick={() => { setBox(bi); setSel({ kind: "bank", id: m.id }); }} className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 py-0.5 pl-0.5 pr-2 text-xs text-zinc-300 hover:border-zinc-500">
                  <Sprite id={m.species} shiny={eff(m).shiny} size={32} />
                  <span>{m.nickname || byId[m.species]?.fr || "?"}</span>
                  <span className="text-zinc-600">{boxes[bi]?.name}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {(moving || sending) && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-sky-500/10 px-3 py-2 text-sm text-sky-200">
          {moving ? "Choisis l'emplacement de destination dans la Banque (un emplacement occupé = échange)." : "Clique sur un emplacement libre de la sauvegarde (pas dans la boîte active du jeu)."}
          <Btn className="!py-1 text-xs" onClick={() => { setMoving(null); setSending(null); }}>Annuler</Btn>
        </div>
      )}

      <div className={cx("grid gap-4", save ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]" : "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        {/* ---------------- Banque ---------------- */}
        <Card className="p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-emerald-400">
            <span>Banque</span>
            <button onClick={() => setOverview(true)} className="inline-flex items-center gap-1 normal-case tracking-normal text-zinc-400 hover:text-white"><LuGrid3X3 className="h-3.5 w-3.5" /> Toutes les boîtes</button>
          </div>
          <div className="mb-3 flex items-center gap-1">
            <button onClick={() => setBox(boxIdx - 1)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Boîte précédente"><LuChevronLeft className="h-5 w-5" /></button>
            {renaming ? (
              <input autoFocus className={cx(inputCls, "flex-1 text-center")} defaultValue={box.name}
                onBlur={(e) => { renameBox(box.id, e.target.value.trim() || box.name); setRenaming(false); }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
            ) : (
              <select className={cx(inputCls, "flex-1 text-center font-semibold")} value={boxIdx} onChange={(e) => setBox(Number(e.target.value))}>
                {boxes.map((b, i) => <option key={b.id} value={i}>{b.name} ({mons.filter((m) => m.box === b.id).length}/{BOX_SIZE})</option>)}
              </select>
            )}
            <button onClick={() => setBox(boxIdx + 1)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Boîte suivante"><LuChevronRight className="h-5 w-5" /></button>
            <button onClick={() => setRenaming(true)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="Renommer la boîte"><LuPencil className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {slots.map((m, i) => (
              <Slot
                key={i}
                mon={m}
                selected={m && sel?.kind === "bank" && sel.id === m.id}
                target={!!moving}
                onClick={() => clickBankSlot(i)}
                onDragStart={() => { dragPayload = { src: "bank", id: m.id }; }}
                onDrop={onBankDrop(i)}
                title={m ? `${m.nickname || byId[m.species]?.fr || "?"}${m.level ? ` · N.${m.level}` : ""}` : undefined}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <Btn className="!px-2.5 !py-1.5 text-xs" onClick={() => { addBox(); setBox(getState().bank.boxes.length - 1); toast("Nouvelle boîte créée"); }}>
              <LuFolderPlus className="h-3.5 w-3.5" /> Nouvelle boîte
            </Btn>
            <span className="flex gap-3">
              {isOfficial && slots.some(Boolean) && <button className="text-violet-300 hover:text-violet-200" onClick={() => setTransferList(slots.filter(Boolean))}>Transférer la boîte…</button>}
              <button className="hover:text-zinc-300" onClick={() => exportZip(slots.filter(Boolean), `${box.name}.zip`)}>Exporter cette boîte</button>
            </span>
          </div>
        </Card>

        {/* ---------------- Sauvegarde ---------------- */}
        {save && (
          <Card className="border-sky-900/60 p-3 sm:p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">Sauvegarde</div>
                <div className="truncate text-sm text-zinc-200" title={save.fileName}>{save.fileName}</div>
                <div className="text-[11px] text-zinc-500">{platformOf(save.platform).label} · structure {save.game}{save.writable ? " · écriture possible" : " · lecture seule"}</div>
              </div>
              <button onClick={() => { setSave(null); setSel(null); setSending(null); }} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white" title="Fermer la sauvegarde"><LuX className="h-4 w-4" /></button>
            </div>
            {isOfficial ? (
              <Field label="Jeu officiel de cette sauvegarde">
                <select className={cx(inputCls, "!py-1.5")} value={saveGame ?? ""} onChange={(e) => setSaveGame(e.target.value)}>
                  {(OFFICIAL_BY_GEN[save.gen] ?? []).map((id) => <option key={id} value={id}>{gameName(id)}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Hack de cette sauvegarde">
                <HackSelect hacks={hacks} platform={savePlatform} value={saveHack} onChange={setSaveHack} className="!py-1.5" />
              </Field>
            )}
            {(isOfficial ? saveGame : saveHack) && (
              <Btn className="mt-2 w-full !py-1.5 text-xs !border-emerald-600/50 !text-emerald-300" onClick={() => setSyncOpen(true)}>
                <LuRefreshCw className="h-3.5 w-3.5" /> Synchroniser le Dex de « {isOfficial ? gameName(saveGame) : hacks.find((h) => h.id === saveHack)?.name} » avec cette sauvegarde
              </Btn>
            )}
            {save.gen === 3 && (
              <Field label="Numérotation des espèces" className="mt-2">
                <select
                  className={cx(inputCls, "!py-1.5")}
                  value={save.speciesMode}
                  onChange={(e) => {
                    const all = new Uint8Array(save.bytes.length + save.extra.length);
                    all.set(save.bytes, 0); all.set(save.extra, save.bytes.length);
                    try { setSave({ ...openSave(save.fileName, all.buffer, { gen3Species: e.target.value, names: namesIndex }), modified: save.modified }); setSel(null); }
                    catch (err) { toast(err.message); }
                  }}
                >
                  <option value="gen3">Gen 3 d'origine (Rouge Feu, Émeraude…)</option>
                  <option value="national">Nationale (hacks pokeemerald-expansion)</option>
                  <option value="cfru">Rouge Feu étendu (type CFRU, ex. Éclat Pourpre)</option>
                </select>
              </Field>
            )}
            {save.warning && <p className="mt-2 flex gap-1.5 text-[11px] text-amber-200/90"><LuInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />{save.warning}</p>}
            {save.boxes.every((b) => !b.slots.some(Boolean)) && (
              <p className="mt-2 rounded-lg bg-zinc-950 p-2 text-[11px] text-zinc-400">Aucun Pokémon trouvé dans le PC de cette sauvegarde{save.party.length ? " : ton équipe est lisible plus bas." : "."}</p>
            )}
            {save.modified && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-sky-500/15 p-2 text-xs text-sky-100">
                Sauvegarde modifiée.
                <Btn variant="primary" className="!py-1 text-xs" onClick={() => { downloadBlob(saveBlob(save), save.fileName); toast("Sauvegarde téléchargée : garde une copie de l'ancienne !"); }}>
                  <LuSave className="h-3.5 w-3.5" /> Télécharger le .sav
                </Btn>
              </div>
            )}
            <div className="my-3 flex items-center gap-1">
              <button onClick={() => setSaveBoxIdx((saveBoxIdx - 1 + save.boxes.length) % save.boxes.length)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Boîte précédente de la sauvegarde"><LuChevronLeft className="h-5 w-5" /></button>
              <select className={cx(inputCls, "flex-1 text-center font-semibold")} value={saveBoxIdx} onChange={(e) => setSaveBoxIdx(Number(e.target.value))}>
                {save.boxes.map((b, i) => <option key={i} value={i}>{b.name}{b.active ? " (active)" : ""} ({b.slots.filter(Boolean).length})</option>)}
              </select>
              <button onClick={() => setSaveBoxIdx((saveBoxIdx + 1) % save.boxes.length)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Boîte suivante de la sauvegarde"><LuChevronRight className="h-5 w-5" /></button>
            </div>
            {saveBox.uninit && <p className="mb-2 text-[11px] text-zinc-500">Boîte jamais ouverte dans le jeu.</p>}
            <div className={cx("grid gap-1.5", saveCols === 5 ? "grid-cols-5" : "grid-cols-6")}>
              {saveBox.slots.map((_, i) => {
                const r = saveRecords.boxes[saveBoxIdx][i];
                return (
                  <Slot
                    key={i}
                    mon={r}
                    selected={r && sel?.kind === "save" && sel.box === saveBoxIdx && sel.slot === i}
                    target={!!sending && save.writable && !saveBox.active}
                    badge={r && bankRaws.has(r.raw) ? "✓" : null}
                    onClick={() => clickSaveSlot(saveBoxIdx, i)}
                    onDragStart={() => { dragPayload = { src: "save", box: saveBoxIdx, slot: i }; }}
                    onDrop={save.writable && !saveBox.active ? onSaveDrop(saveBoxIdx, i) : undefined}
                    title={r ? `${r.nickname || byId[r.species]?.fr || "?"} — glisser vers la Banque` : undefined}
                  />
                );
              })}
            </div>
            {saveRecords.party.length > 0 && (
              <>
                <div className="mb-1 mt-3 text-xs text-zinc-500">Équipe</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {saveRecords.party.map((r, i) => (
                    <Slot key={i} mon={r} selected={sel?.kind === "party" && sel.i === i} badge={bankRaws.has(r?.raw) ? "✓" : null}
                      onClick={() => setSel({ kind: "party", i })} onDragStart={() => { dragPayload = { src: "save", party: i }; }} />
                  ))}
                </div>
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn className="!px-2.5 !py-1.5 text-xs" onClick={() => copyToBank(saveRecords.boxes[saveBoxIdx])}><LuCopy className="h-3.5 w-3.5" /> Copier cette boîte</Btn>
              <Btn className="!px-2.5 !py-1.5 text-xs" onClick={() => copyToBank([...saveRecords.boxes.flat(), ...saveRecords.party])}><LuCopy className="h-3.5 w-3.5" /> Copier toute la sauvegarde</Btn>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">Glisse un Pokémon d'un panneau à l'autre. ✓ = déjà dans la Banque. La copie ne retire rien de ta sauvegarde.</p>
          </Card>
        )}

        {/* ---------------- Fiche ---------------- */}
        <Card className="lg:sticky lg:top-4 lg:self-start">
          {selMon ? (
            <MonDetail mon={selMon} hackLabel={sel.kind === "bank" ? originLabel(selMon) : isOfficial ? `${gameName(saveGame)} (jeu officiel)` : hackName(saveHack)} location={selLocation} actions={actions} />
          ) : (
            <div className="py-4 text-sm text-zinc-500">
              <p className="mb-3 text-center">Sélectionne un Pokémon pour voir sa fiche.</p>
              <div className="space-y-2 rounded-xl bg-zinc-950 p-3 text-left text-xs leading-relaxed text-zinc-400">
                <p className="font-semibold text-zinc-300">Comment ça marche</p>
                <p>1. <b>Ouvre la sauvegarde</b> (.sav, .srm, .dsv…) de ton hack Game Boy, GBC, GBA ou DS : pas besoin de PKHeX.</p>
                <p>2. <b>Glisse</b> ses Pokémon dans la Banque (ou « Copier cette boîte »). Ils sont gardés octet pour octet dans ce navigateur.</p>
                <p>3. Pour les ramener dans un jeu : ouvre la sauvegarde cible, glisse le Pokémon de la Banque vers un emplacement libre, puis <b>télécharge le .sav modifié</b>.</p>
                <p className="text-amber-200/80">Garde toujours une copie de ta sauvegarde avant d'en remplacer une.</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      </>)}
      {importRes && (
        <ImportDialog
          results={importRes}
          hacks={hacks}
          kind={bank.kind}
          onCancel={() => setImportRes(null)}
          onConfirm={(list) => {
            const placed = addMons(list, box.id);
            setImportRes(null);
            if (placed[0]) { setSel({ kind: "bank", id: placed[0].id }); setBox(Math.max(0, getState().bank.boxes.findIndex((b) => b.id === placed[0].box))); }
            toast(`${placed.length} Pokémon ajouté(s) à la Banque`);
          }}
        />
      )}
      {editor && (
        <MonEditor
          mon={editor.mon}
          kind={bank.kind}
          defaultHack={hacks[0]}
          onClose={() => setEditor(null)}
          onSave={(data) => {
            if (editor.mon) { updateMon(editor.mon.id, data); toast("Fiche mise à jour"); }
            else { const [m] = addMons([isOfficial ? { ...data, hack: null } : { ...data, game: null }], box.id); setSel({ kind: "bank", id: m.id }); toast("Pokémon ajouté"); }
            setEditor(null);
          }}
        />
      )}
      {hackMgr && <HackManager hacks={hacks} mons={mons} onClose={() => setHackMgr(false)} />}
      {overview && <BoxOverview boxes={boxes} mons={mons} current={boxIdx} toast={toast} onClose={() => setOverview(false)} onOpen={(i) => { setBox(i); setOverview(false); }} />}
      {bankDialog && bankDialog.mode !== "delete" && (
        <Modal open onClose={() => setBankDialog(null)} title={bankDialog.mode === "new" ? `Nouvelle banque · ${(bankDialog.kind ?? bank.kind) === "official" ? "Jeux officiels" : "ROM hacks"}` : "Renommer la banque"}>
          <form onSubmit={(e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget).get("name");
            if (bankDialog.mode === "new") { createBank(name, bankDialog.kind ?? bank.kind); setPref("bankBox", 0); setSel(null); toast("Banque créée"); }
            else { renameBank(vault.active, name); toast("Banque renommée"); }
            setBankDialog(null);
          }}>
            <Field label="Nom de la banque">
              <input name="name" autoFocus className={inputCls} defaultValue={bankDialog.mode === "rename" ? bank.name : ""} placeholder="ex. Cœur d'Or Ultra, Shiny, Légendaires…" />
            </Field>
            <p className="mt-2 text-xs text-zinc-500">Chaque banque a ses propres boîtes et Pokémon. Les banques « Jeux officiels » et « ROM hacks » sont séparées : un Pokémon ne passe pas de l'une à l'autre.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Btn type="button" onClick={() => setBankDialog(null)}>Annuler</Btn>
              <Btn type="submit" variant="primary">{bankDialog.mode === "new" ? "Créer" : "Renommer"}</Btn>
            </div>
          </form>
        </Modal>
      )}
      <Confirm
        open={bankDialog?.mode === "delete"}
        title={`Supprimer « ${bank.name} » ?`}
        message={mons.length ? `Cette banque contient ${mons.length} Pokémon : ils seront supprimés. Exporte-la avant si tu veux les garder.` : "Cette banque est vide."}
        confirmLabel="Supprimer la banque"
        onConfirm={() => { deleteBank(vault.active); setPref("bankBox", 0); setSel(null); toast("Banque supprimée"); }}
        onClose={() => setBankDialog(null)}
      />
      <Confirm
        open={!!originConfirm}
        title="Envoyer dans un autre jeu que celui d'origine ?"
        message={originConfirm?.message ?? ""}
        confirmLabel="Envoyer quand même"
        onConfirm={() => writeMonToSave(originConfirm.monId, originConfirm.sBox, originConfirm.sSlot, true)}
        onClose={() => setOriginConfirm(null)}
      />
      {transferList && <TransferDialog mons={transferList.map((m) => getState().bank.mons.find((x) => x.id === m.id) ?? m)} toast={toast} onClose={() => { setTransferList(null); setSel((x) => x); }} />}
      {syncOpen && save && saveRecords && (
        <SyncDialog
          records={[...saveRecords.boxes.flat(), ...saveRecords.party]}
          target={isOfficial ? { gid: saveGame, name: gameName(saveGame) } : { gid: hackGameId(saveHack), name: hacks.find((h) => h.id === saveHack)?.name ?? "hack" }}
          onClose={() => setSyncOpen(false)}
          toast={toast}
        />
      )}
      <Confirm
        open={!!confirmDel}
        title="Retirer ce Pokémon ?"
        message="Il sera supprimé de la Banque, ainsi que ses données. Télécharge-le d'abord si tu veux le garder."
        confirmLabel="Retirer"
        onConfirm={() => { deleteMon(confirmDel.id); setSel(null); toast("Pokémon retiré"); }}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
}
