import { useEffect, useMemo, useState } from "react";
import { LuArrowRight, LuBan, LuCheck, LuChevronDown, LuChevronRight, LuInfo, LuLoader, LuRefreshCw, LuSearch, LuSparkles, LuTriangleAlert } from "react-icons/lu";
import { GAMES, genStyle } from "../data/games.js";
import { GAME_INFO, GUIDE_GAMES, KIND_LABEL, evolutionsInGame, loadGuideData, obtainableInGame, speciesDescription, transferNeeds } from "../data/gameGuide.js";
import { loadMoveAbilityNames } from "../data/pokedata.js";
import { OFFICIAL_META } from "../lib/officialTransfer.js";
import { useStore } from "../lib/store.js";
import { Btn, Card, ShinyStar, Sprite, cx, inputCls, matchSearch, pad, useData } from "./ui.jsx";
import SpeciesPicker from "./SpeciesPicker.jsx";

const OFFICIAL = GAMES.filter((g) => GAME_INFO[g.id]);
const gName = (id) => GAMES.find((g) => g.id === id)?.name ?? id;
const genOf = (id) => GAMES.find((g) => g.id === id)?.gen ?? 1;
const REASON = {
  capture: "Capturable",
  evolution: "Par évolution",
  reproduction: "Par reproduction",
  regional: "Pokédex régional (estimation)",
  check: "À vérifier (don, Pokémon fixe ou autre version)",
};

// ------------------------------------------------------------------ données
export function useGuide() {
  const { byId } = useData();
  const [state, setState] = useState({ data: null, error: null, tick: 0 });
  const load = (force = false) => {
    setState((s) => ({ ...s, error: null, data: force ? null : s.data }));
    Promise.all([loadGuideData({ force }), loadMoveAbilityNames().catch(() => ({ moves: {} }))])
      .then(([data, names]) => setState({ data: { ...data, moveNames: names.moves ?? {}, speciesName: (id) => byId[id]?.fr }, error: null }))
      .catch((e) => setState({ data: null, error: e.message }));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line
  return { ...state, reload: () => load(true) };
}

export function useGuideIndex(data, { withNeeds = true } = {}) {
  const { gameDex, dexes, byId } = useData();
  return useMemo(() => {
    if (!data) return null;
    const evoByGame = {}, obtainable = {};
    for (const gid of GUIDE_GAMES) {
      evoByGame[gid] = evolutionsInGame(data, gid, (s) => gameDex[gid]?.set.has(s));
      obtainable[gid] = obtainableInGame(data, gid, gameDex, dexes);
    }
    const needs = {};
    if (withNeeds) for (const gid of GUIDE_GAMES) needs[gid] = transferNeeds(gid, gameDex, obtainable, { gameDex, byId });
    return { evoByGame, obtainable, needs };
  }, [data, gameDex, dexes, byId, withNeeds]);
}

function Loading({ error, reload }) {
  return (
    <Card className="py-10 text-center text-sm text-zinc-400">
      {error ? (
        <>
          <LuTriangleAlert className="mx-auto mb-2 h-6 w-6 text-amber-400" />
          Données du guide indisponibles ({error}). Il faut être en ligne au premier chargement.
          <div className="mt-3"><Btn onClick={reload}><LuRefreshCw className="h-4 w-4" /> Réessayer</Btn></div>
        </>
      ) : (
        <><LuLoader className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-400" />Chargement des évolutions et des lieux de capture (PokéAPI, une seule fois, ~5 Mo)…</>
      )}
    </Card>
  );
}

function Section({ title, count, tone = "text-zinc-100", children, defaultOpen = true, hint }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="p-0">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className={cx("flex items-center gap-2 font-semibold", tone)}>
          {open ? <LuChevronDown className="h-4 w-4" /> : <LuChevronRight className="h-4 w-4" />}{title}
          {count != null && <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs tabular-nums text-zinc-300">{count}</span>}
        </span>
      </button>
      {open && <div className="border-t border-zinc-800 px-4 py-3">{hint && <p className="mb-3 text-xs text-zinc-500">{hint}</p>}{children}</div>}
    </Card>
  );
}

/** Petite vignette d'un Pokémon avec son état dans ton Dex / ta Banque. */
function MonChip({ sp, gid, onOpen, extra }) {
  const { byId } = useData();
  const dex = useStore((s) => s.dex);
  const e = dex[sp]?.[gid];
  const done = e?.caught || e?.shinyCaught;
  return (
    <button onClick={() => onOpen(sp)} title={extra ?? ""} className={cx("flex items-center gap-1.5 rounded-xl border py-0.5 pl-0.5 pr-2 text-left text-xs transition hover:border-zinc-500", done ? "border-emerald-600/50 bg-emerald-500/10" : "border-zinc-800 bg-zinc-950")}>
      <Sprite id={sp} size={34} dim={!done} />
      <span className="min-w-0">
        <span className={cx("block truncate", done ? "text-emerald-200" : "text-zinc-200")}>{byId[sp]?.fr}</span>
        <span className="block text-[10px] text-zinc-500">#{pad(sp)}{done ? " · déjà dans ce jeu" : ""}{e?.shinyCaught ? " ★" : ""}</span>
      </span>
    </button>
  );
}

// ------------------------------------------------------------------ vue « Par jeu »
export function GuideByGame({ gid, setGid, openPokemon }) {
  const { byId, gameDex } = useData();
  const dex = useStore((s) => s.dex);
  const vault = useStore((s) => s.vault);
  const { data, error, reload } = useGuide();
  const idx = useGuideIndex(data);
  const [q, setQ] = useState("");
  const [hideDone, setHideDone] = useState(false);

  const inBank = useMemo(() => {
    const m = {};
    for (const b of vault.banks) if (b.kind === "official") for (const x of b.mons) if (x.species && x.game) { (m[x.species] ??= {})[x.game] = (m[x.species][x.game] ?? 0) + 1; }
    return m;
  }, [vault]);

  if (!data || !idx) return <Loading error={error} reload={reload} />;
  const info = GAME_INFO[gid];
  const ob = idx.obtainable[gid];
  const doneIn = (sp) => dex[sp]?.[gid]?.caught || dex[sp]?.[gid]?.shinyCaught;
  const keep = (sp) => (!q || matchSearch(byId[sp], q)) && (!hideDone || !doneIn(sp));
  const total = gameDex[gid].ids.length;
  const counts = { capture: 0, evolution: 0, reproduction: 0, regional: 0, check: 0 };
  for (const v of ob.how.values()) counts[v.reason]++;
  const needs = idx.needs[gid];

  // regroupement par meilleure source
  const groups = new Map();
  const noSource = [];
  for (const n of needs) {
    if (!keep(n.species)) continue;
    if (!n.sources.length) { noSource.push(n); continue; }
    const s = n.sources[0];
    const k = s.game;
    if (!groups.has(k)) groups.set(k, { src: s, list: [] });
    groups.get(k).list.push(n);
  }
  const groupList = [...groups.values()].sort((a, b) => (b.src.sameGen - a.src.sameGen) || (b.src.stage - a.src.stage));
  const toCheck = [...ob.how.entries()].filter(([sp, v]) => v.reason === "check" && keep(sp)).map(([sp]) => sp);
  const evos = idx.evoByGame[gid].filter((e) => !q || matchSearch(byId[e.to], q) || matchSearch(byId[e.from], q));
  const byKind = {};
  for (const e of evos) (byKind[e.kind] ??= []).push(e);
  const prepared = (sp, src) => inBank[sp]?.[src] || dex[sp]?.[src]?.transferQuota || dex[sp]?.[src]?.shinyQuota;

  return (
    <div className="space-y-4">
      {/* Sélecteur de jeu */}
      <div className="-mx-1 flex flex-wrap gap-1.5">
        {OFFICIAL.map((g) => {
          const st = genStyle(g.gen);
          return (
            <button key={g.id} onClick={() => setGid(g.id)}
              className={cx("rounded-xl border px-2.5 py-1.5 text-left text-xs transition", g.id === gid ? cx(st.border, st.soft, "ring-1", st.ring, "text-white") : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600")}>
              <span className={cx("mr-1 text-[9px] font-bold", st.text)}>G{g.gen}</span>{g.name}
            </button>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">{gName(gid)}</h2>
            <p className="text-xs text-zinc-500">Pokédex de {total} espèces · Gen {info.gen}{info.breeding ? "" : " · pas de reproduction"}{info.side ? " · jeu « à part » (méthodes propres)" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input className={cx(inputCls, "w-48 pl-9")} placeholder="Filtrer un Pokémon…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <div className="rounded-xl bg-zinc-950 p-2"><div className="text-xl font-bold tabular-nums text-emerald-300">{counts.capture + counts.regional}</div><div className="text-[11px] text-zinc-500">capturables</div></div>
          <div className="rounded-xl bg-zinc-950 p-2"><div className="text-xl font-bold tabular-nums text-emerald-300">{counts.evolution + counts.reproduction}</div><div className="text-[11px] text-zinc-500">par évolution / reproduction</div></div>
          <div className="rounded-xl bg-zinc-950 p-2"><div className="text-xl font-bold tabular-nums text-amber-300">{counts.check}</div><div className="text-[11px] text-zinc-500">à vérifier</div></div>
          <div className="rounded-xl bg-zinc-950 p-2"><div className="text-xl font-bold tabular-nums text-violet-300">{needs.length}</div><div className="text-[11px] text-zinc-500">à faire venir d'un autre jeu</div></div>
        </div>
        {!ob.hasEncounters && (
          <p className="mt-3 flex gap-2 text-xs text-amber-200/90"><LuInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />La PokéAPI n'a pas les lieux de capture de {gName(gid)} : les Pokémon du Pokédex régional sont considérés comme trouvables (les exclusivités de l'autre version ne sont pas détectées).</p>
        )}
        <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Masquer les Pokémon déjà cochés dans {gName(gid)}
        </label>
      </Card>

      <Section title="À faire venir d'un autre jeu" count={needs.length} tone="text-violet-200"
        hint={`Pokémon du Pokédex de ${gName(gid)} qu'on ne peut ni capturer, ni obtenir par évolution${info.breeding ? " ou reproduction" : ""} dans le jeu. Classés par jeu d'où les transférer : même génération d'abord (échange), puis la génération précédente la plus proche. En vert : déjà prêt (dans ta Banque officielle ou en quota de transfert).`}>
        {!needs.length && <p className="text-sm text-zinc-500">Aucun : tout le Pokédex de ce jeu s'obtient sur place 🎉</p>}
        <div className="space-y-3">
          {groupList.map(({ src, list }) => (
            <div key={src.game} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className={cx("h-2.5 w-2.5 rounded-full", genStyle(genOf(src.game)).bg)} />
                <span className="font-medium text-zinc-100">Depuis {gName(src.game)}</span>
                <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-semibold", src.sameGen ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300")}>{src.sameGen ? "même génération" : `Gen ${OFFICIAL_META[src.game].gen} → Gen ${OFFICIAL_META[gid].gen}`}</span>
                <span className="flex flex-wrap items-center gap-1 text-[11px] text-zinc-400">
                  {src.steps.map((s, i) => <span key={i} className="flex items-center gap-1">{i > 0 && <LuArrowRight className="h-3 w-3 text-zinc-600" />}{s.label}</span>)}
                </span>
                <span className="ml-auto text-xs tabular-nums text-zinc-500">{list.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((n) => (
                  <div key={n.species} className={cx("rounded-xl", prepared(n.species, src.game) && "ring-1 ring-emerald-500/70")}>
                    <MonChip sp={n.species} gid={gid} onOpen={openPokemon} extra={`Aussi depuis : ${n.sources.slice(1).map((s) => gName(s.game)).join(", ") || "—"}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {noSource.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="mb-2 text-sm font-medium text-amber-200">Aucun jeu suivi ne le donne ({noSource.length})</div>
              <p className="mb-2 text-[11px] text-zinc-500">Distribution événementielle, autre version, ou jeu absent de ta liste (Colosseum, Pokémon GO…).</p>
              <div className="flex flex-wrap gap-1.5">{noSource.map((n) => <MonChip key={n.species} sp={n.species} gid={gid} onOpen={openPokemon} />)}</div>
            </div>
          )}
        </div>
      </Section>

      {counts.check > 0 && (
        <Section title="À vérifier" count={toCheck.length} tone="text-amber-200" defaultOpen={false}
          hint={`Dans le Pokédex régional de ${gName(gid)} mais dans aucun lieu de capture connu : Pokémon donné (starter, fossile), Pokémon fixe (légendaire), ou exclusivité de l'autre version (à échanger). Clique sur un Pokémon pour voir où il s'obtient.`}>
          <div className="flex flex-wrap gap-1.5">{toCheck.map((sp) => <MonChip key={sp} sp={sp} gid={gid} onOpen={openPokemon} />)}</div>
        </Section>
      )}

      <Section title="Méthodes d'évolution" count={evos.length} tone="text-zinc-100"
        hint={`Méthodes valables dans ${gName(gid)}. Si une évolution est impossible ici, le jeu où la faire est indiqué : fais-la évoluer là-bas puis transfère-la.`}>
        <div className="space-y-4">
          {Object.keys(KIND_LABEL).filter((k) => byKind[k]?.length).map((k) => (
            <div key={k}>
              <div className={cx("mb-1.5 text-xs font-semibold uppercase tracking-wide", k === "impossible" ? "text-red-300" : "text-zinc-400")}>{KIND_LABEL[k]} · {byKind[k].length}</div>
              <div className="overflow-hidden rounded-xl border border-zinc-800">
                {byKind[k].map((e) => (
                  <div key={`${e.from}-${e.to}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-800/70 bg-zinc-950 px-3 py-1.5 first:border-t-0">
                    <button onClick={() => openPokemon(e.from)} className="flex w-28 items-center gap-1 truncate text-xs text-zinc-400 hover:text-zinc-200"><Sprite id={e.from} size={30} />{byId[e.from]?.fr}</button>
                    <LuArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                    <button onClick={() => openPokemon(e.to)} className="flex w-32 items-center gap-1 truncate text-sm text-zinc-100 hover:underline"><Sprite id={e.to} size={30} />{byId[e.to]?.fr}</button>
                    <div className="min-w-0 flex-1 text-xs">
                      {e.methods.length ? (
                        e.methods.map((m, i) => <div key={i} className="text-zinc-200">{i > 0 && <span className="text-zinc-500">ou </span>}{m}</div>)
                      ) : (
                        <span className="text-red-300">
                          <LuBan className="mr-1 inline h-3 w-3" />Impossible dans {gName(gid)}
                          {(() => {
                            const where = GUIDE_GAMES.filter((g) => g !== gid && idx.evoByGame[g].some((x) => x.to === e.to && x.methods.length)).map(gName);
                            return where.length ? <span className="text-zinc-400"> — à faire dans : {where.join(", ")}</span> : null;
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------ fiche Pokémon (vue « Par Pokémon »)
const TYPE_COLORS = { 1: "bg-zinc-500", 2: "bg-orange-700", 3: "bg-sky-400", 4: "bg-purple-500", 5: "bg-amber-700", 6: "bg-stone-500", 7: "bg-lime-600", 8: "bg-indigo-600", 9: "bg-slate-400", 10: "bg-red-500", 11: "bg-blue-500", 12: "bg-green-500", 13: "bg-yellow-400 text-zinc-900", 14: "bg-pink-500", 15: "bg-cyan-300 text-zinc-900", 16: "bg-violet-600", 17: "bg-zinc-700", 18: "bg-pink-300 text-zinc-900" };

export function PokemonSheet({ species, setSpecies, openGame }) {
  const { byId, gameDex, hackGames } = useData();
  const dex = useStore((s) => s.dex);
  const vault = useStore((s) => s.vault);
  const { data, error, reload } = useGuide();
  const idx = useGuideIndex(data);
  const [desc, setDesc] = useState(null);
  const [evoGame, setEvoGame] = useState(null);
  const sp = byId[species];

  useEffect(() => {
    setDesc(null);
    let alive = true;
    speciesDescription(species).then((d) => alive && setDesc(d)).catch(() => alive && setDesc({ error: true }));
    return () => { alive = false; };
  }, [species]);

  const family = useMemo(() => {
    if (!data) return [];
    const chain = data.species[species]?.chain;
    return Object.entries(data.species).filter(([, v]) => v.chain === chain).map(([id]) => Number(id)).sort((a, b) => a - b);
  }, [data, species]);

  const copies = useMemo(() => {
    const out = [];
    for (const b of vault.banks) for (const m of b.mons) if (m.species === species) out.push({ bank: b, m });
    return out;
  }, [vault, species]);

  if (!sp) return null;
  const picker = <div className="max-w-md"><SpeciesPicker value={species} onChange={setSpecies} /></div>;
  if (!data || !idx) return <div className="space-y-4">{picker}<Loading error={error} reload={reload} /></div>;

  const types = data.types[species] ?? [];
  const gamesWith = OFFICIAL.filter((g) => gameDex[g.id]?.set.has(species));
  const eg = evoGame && gameDex[evoGame]?.set.has(species) ? evoGame : gamesWith.at(-1)?.id ?? OFFICIAL.at(-1).id;
  const evos = (idx.evoByGame[eg] ?? []).filter((e) => family.includes(e.to));

  return (
    <div className="space-y-4">
      {picker}
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex gap-2">
            <div className="rounded-2xl bg-zinc-950 p-2 text-center"><Sprite id={species} size={112} /><div className="text-[10px] text-zinc-500">Normal</div></div>
            <div className="relative rounded-2xl bg-zinc-950 p-2 text-center"><Sprite id={species} shiny size={112} /><ShinyStar className="absolute right-2 top-2 h-4 w-4" /><div className="text-[10px] text-zinc-500">Shiny</div></div>
          </div>
          <div className="min-w-[220px] flex-1">
            <div className="text-xs tabular-nums text-zinc-500">#{pad(species)} · Gen {sp.gen}</div>
            <h2 className="text-2xl font-bold text-zinc-50">{sp.fr} <span className="text-base font-normal text-zinc-500">{sp.en}</span></h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {types.filter(Boolean).map((t) => <span key={t} className={cx("rounded-full px-2.5 py-0.5 text-xs font-semibold text-white", TYPE_COLORS[t] ?? "bg-zinc-600")}>{data.typeNames[t] ?? t}</span>)}
              {desc?.legendary && <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs text-amber-200">Légendaire</span>}
              {desc?.mythical && <span className="rounded-full bg-fuchsia-500/20 px-2.5 py-0.5 text-xs text-fuchsia-200">Fabuleux</span>}
              {desc?.baby && <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-xs text-sky-200">Bébé</span>}
            </div>
            {desc?.genus && <div className="mt-2 text-sm text-zinc-300">{desc.genus}</div>}
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{desc ? (desc.error ? "Description indisponible hors ligne." : desc.text) : "Chargement de la description…"}</p>
          </div>
        </div>
      </Card>

      <Section title="Disponibilité dans chaque jeu" count={gamesWith.length}
        hint="Pour chaque jeu officiel : comment l'obtenir sur place, ou d'où le faire venir, et ce que tu as déjà coché dans ton Dex.">
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          {OFFICIAL.map((g) => {
            const inDex = gameDex[g.id]?.set.has(species);
            const how = idx.obtainable[g.id].how.get(species);
            const need = idx.needs[g.id].find((n) => n.species === species);
            const e = dex[species]?.[g.id];
            const st = genStyle(g.gen);
            return (
              <div key={g.id} className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-800/70 px-3 py-1.5 text-xs first:border-t-0", inDex ? "bg-zinc-950" : "bg-zinc-950/40 text-zinc-600")}>
                <button onClick={() => openGame(g.id)} className="flex w-40 items-center gap-2 text-left hover:underline">
                  <span className={cx("h-2 w-2 rounded-full", st.bg, !inDex && "opacity-30")} /><span className={inDex ? "text-zinc-200" : ""}>{g.name}</span>
                </button>
                <span className="min-w-0 flex-1">
                  {!inDex ? "Absent de ce jeu" : how ? (
                    <span className={how.reason === "check" ? "text-amber-200" : "text-emerald-300"}>
                      <LuCheck className="mr-1 inline h-3 w-3" />{REASON[how.reason]}{how.from ? ` (de ${byId[how.from]?.fr})` : ""}
                    </span>
                  ) : need?.sources.length ? (
                    <span className="text-violet-200">À faire venir depuis {need.sources.slice(0, 3).map((s) => gName(s.game)).join(", ")}{need.sources.length > 3 ? "…" : ""}</span>
                  ) : <span className="text-amber-300">Introuvable dans les jeux suivis (événement…)</span>}
                </span>
                {inDex && (
                  <span className="w-28 text-right">
                    {e?.caught && <span className="text-emerald-300">✓ capturé</span>}
                    {e?.shinyCaught && <span className="ml-1 text-amber-300">★</span>}
                    {(e?.transferQuota || e?.shinyQuota) ? <span className="ml-1 text-sky-300">+{(e.transferQuota || 0) + (e.shinyQuota || 0)}</span> : null}
                    {!e?.caught && !e?.shinyCaught && <span className="text-zinc-600">—</span>}
                  </span>
                )}
              </div>
            );
          })}
          {hackGames.filter((h) => gameDex[h.id]?.set.has(species)).map((h) => {
            const e = dex[species]?.[h.id];
            return (
              <div key={h.id} className="flex items-center gap-3 border-t border-zinc-800/70 bg-zinc-950 px-3 py-1.5 text-xs">
                <span className="w-40 text-teal-200">{h.name} <span className="text-[10px] text-teal-400/70">hack</span></span>
                <span className="flex-1 text-zinc-500">Dex du hack</span>
                <span className="w-28 text-right">{e?.caught ? <span className="text-emerald-300">✓ capturé</span> : <span className="text-zinc-600">—</span>}{e?.shinyCaught && <span className="ml-1 text-amber-300">★</span>}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Évolutions" count={family.length > 1 ? family.length : null}
        hint="Les méthodes changent selon le jeu : choisis le jeu pour voir celle qui s'applique.">
        {family.length <= 1 ? <p className="text-sm text-zinc-500">{sp.fr} n'évolue pas.</p> : (
          <>
            <select className={cx(inputCls, "mb-3 w-auto")} value={eg} onChange={(e) => setEvoGame(e.target.value)}>
              {gamesWith.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <div className="mb-3 flex flex-wrap items-center gap-1">
              {family.map((f) => (
                <button key={f} onClick={() => setSpecies(f)} className={cx("flex flex-col items-center rounded-xl px-1 py-1 text-[11px]", f === species ? "bg-emerald-500/10 text-emerald-200" : "text-zinc-400 hover:bg-zinc-800")}>
                  <Sprite id={f} size={48} dim={!gameDex[eg]?.set.has(f)} />{byId[f]?.fr}
                </button>
              ))}
            </div>
            <div className="space-y-1 text-xs">
              {evos.map((e) => (
                <div key={`${e.from}-${e.to}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-950 px-2 py-1.5">
                  <span className="w-24 text-zinc-400">{byId[e.from]?.fr}</span><LuArrowRight className="h-3 w-3 text-zinc-600" /><span className="w-28 text-zinc-100">{byId[e.to]?.fr}</span>
                  <span className="flex-1">{e.methods.length ? <span className="text-zinc-200">{e.methods.join(" · ou ")}</span> : <span className="text-red-300">Impossible dans {gName(eg)}</span>}</span>
                </div>
              ))}
              {!evos.length && <p className="text-zinc-500">Cette famille n'est pas (entièrement) dans {gName(eg)}.</p>}
            </div>
          </>
        )}
      </Section>

      {copies.length > 0 && (
        <Section title="Dans tes banques" count={copies.length}>
          <div className="flex flex-wrap gap-1.5">
            {copies.map(({ bank, m }) => (
              <span key={m.id} className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 py-0.5 pl-0.5 pr-2 text-xs text-zinc-300">
                <Sprite id={species} shiny={m.shiny} size={30} />{m.nickname || sp.fr}<span className="text-zinc-500">· {bank.name}{m.game ? ` · ${gName(m.game)}` : ""}</span>
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/** Évolutions d'une espèce dans un jeu (fiche d'un Pokémon de la Banque). */
export function SpeciesEvolutions({ species, game }) {
  const { byId } = useData();
  const { data, error } = useGuide();
  const idx = useGuideIndex(data, { withNeeds: false });
  if (error) return <p className="text-[11px] text-amber-300">Évolutions indisponibles hors ligne.</p>;
  if (!idx) return <p className="text-[11px] text-zinc-500">Chargement des évolutions…</p>;
  const evos = idx.evoByGame[game] ?? [];
  const rel = evos.filter((e) => e.from === species || e.to === species);
  if (!rel.length) return <p className="text-[11px] text-zinc-500">Pas d'évolution dans {gName(game)}.</p>;
  return (
    <div className="space-y-0.5 text-[11px]">
      {rel.map((e) => (
        <div key={`${e.from}-${e.to}`}>
          <span className="text-zinc-300">{e.to === species ? `Évolue de ${byId[e.from]?.fr}` : `Évolue en ${byId[e.to]?.fr}`} : </span>
          {e.methods.length ? <span className="text-zinc-200">{e.methods.join(" · ou ")}</span> : <span className="text-red-300">impossible dans {gName(game)}</span>}
        </div>
      ))}
      <a href={`#guide-pokemon-${species}`} className="text-violet-300 hover:underline">Fiche complète →</a>
    </div>
  );
}
