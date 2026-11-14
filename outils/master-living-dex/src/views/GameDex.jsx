import { useCallback, useMemo, useState } from "react";
import { LuInfo, LuListChecks, LuSearch, LuSparkles, LuZap } from "react-icons/lu";
import { GAMES, GAME_BY_ID, genStyle } from "../data/games.js";
import { bulkSetCaught, getEntry, isFilled, setPref, updateEntry, useStore } from "../lib/store.js";
import { Bar, Btn, Chip, Confirm, cx, inputCls, matchSearch, useData } from "../components/ui.jsx";
import { Grid, PokemonCard, useIncremental } from "../components/PokemonGrid.jsx";
import { EntryModal } from "../components/EntryModal.jsx";

const STATUS = [
  ["all", "Tous"],
  ["missing", "Manquants"],
  ["caught", "Capturés"],
  ["shiny", "Shiny"],
  ["quota", "À transférer"],
  ["event", "Event / note"],
];

export default function GameDex({ gameId }) {
  const { species, byId, gameDex, gameById, hackGames } = useData();
  const dex = useStore((s) => s.dex);
  const prefs = useStore((s) => s.prefs);
  const gid = gameById[gameId] ? gameId : gameById[prefs.activeGame] ? prefs.activeGame : GAMES[0].id;
  const game = gameById[gid];
  const gd = gameDex[gid];
  const gs = genStyle(game.gen);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [outside, setOutside] = useState(false);
  const [open, setOpen] = useState(null);
  const [bulk, setBulk] = useState(null);

  const selectGame = (id) => {
    setPref("activeGame", id);
    window.location.hash = `jeux-${id.replace(":", "_")}`;
  };

  const caughtCount = useMemo(() => gd.ids.filter((id) => isFilled(dex[id]?.[gid])).length, [gd, dex, gid]);
  const shinyCount = useMemo(() => gd.ids.filter((id) => dex[id]?.[gid]?.shinyCaught).length, [gd, dex, gid]);

  const list = useMemo(() => {
    let ids = gd.ids;
    if (outside) ids = [...ids, ...species.map((s) => s.id).filter((id) => !gd.set.has(id))];
    return ids
      .map((id) => byId[id])
      .filter((s) => {
        if (!s || !matchSearch(s, q)) return false;
        const e = getEntry(dex, s.id, gid);
        switch (status) {
          case "missing": return !isFilled(e);
          case "caught": return isFilled(e);
          case "shiny": return e.shinyCaught;
          case "quota": return e.transferQuota > 0 || e.shinyQuota > 0;
          case "event": return !!e.eventRequired;
          default: return true;
        }
      });
  }, [gd, outside, species, byId, q, status, dex, gid]);

  const { visible, more, sentinel } = useIncremental(list);
  const onOpen = useCallback((id) => setOpen(id), []);
  const onQuick = useCallback(
    (id) => {
      const e = getEntry(dex, id, gid);
      updateEntry(id, gid, { caught: !e.caught });
    },
    [dex, gid],
  );

  return (
    <div>
      {/* Sélecteur de jeu */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        {[...GAMES, ...(hackGames.length ? [{ sep: true }] : []), ...hackGames].map((g) => {
          if (g.sep) return <div key="sep" className="flex shrink-0 items-center px-1 text-[10px] font-bold uppercase tracking-wide text-zinc-600">ROM hacks</div>;
          const st = genStyle(g.gen);
          const active = g.id === gid;
          return (
            <button
              key={g.id}
              onClick={() => selectGame(g.id)}
              className={cx(
                "shrink-0 rounded-xl border px-3 py-2 text-left transition",
                active ? cx(st.border, st.soft, "ring-1", st.ring) : "border-zinc-800 bg-zinc-900 hover:border-zinc-600",
              )}
            >
              <div className={cx("text-[10px] font-bold uppercase tracking-wide", g.isHack ? "text-teal-300" : st.text)}>{g.isHack ? `Hack · ${st.label}` : st.label}</div>
              <div className={cx("whitespace-nowrap text-sm font-medium", active ? "text-white" : "text-zinc-300")}>{g.name}</div>
            </button>
          );
        })}
      </div>

      <div className="sticky top-0 z-20 -mx-4 mb-4 space-y-3 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="min-w-[220px] flex-1">
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-zinc-100">
                {game.name} <span className="font-normal text-zinc-500">· {game.region}{game.isHack ? ` · Pokédex de ${gd.ids.length} espèces (réglable dans Banque › Mes hacks)` : ""}</span>
              </span>
              <span className="tabular-nums text-zinc-400">
                <span className="text-zinc-100">{caughtCount}</span>/{gd.ids.length}
                <span className="ml-2 inline-flex items-center gap-0.5 text-amber-300"><LuSparkles className="h-3 w-3" />{shinyCount}</span>
              </span>
            </div>
            <Bar value={caughtCount} max={gd.ids.length} color={gs.bg} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPref("quickMode", !prefs.quickMode)}
              className={cx("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs", prefs.quickMode ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400")}
              title="Affiche une case à cocher sur chaque carte pour marquer en un clic"
            >
              <LuZap className="h-3.5 w-3.5" /> Coche rapide
            </button>
            <Btn className="!px-2.5 !py-1.5 text-xs" onClick={() => setBulk(true)} disabled={!list.length}>
              <LuListChecks className="h-3.5 w-3.5" /> Actions groupées
            </Btn>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input className={cx(inputCls, "pl-9")} placeholder="Nom ou numéro…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {STATUS.map(([k, l]) => (
              <Chip key={k} active={status === k} onClick={() => setStatus(k)}>{l}</Chip>
            ))}
            {game.dex.type === "pokedex" && (
              <Chip active={outside} onClick={() => setOutside(!outside)}>+ hors dex régional</Chip>
            )}
          </div>
        </div>
      </div>

      {gd.approx && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <LuInfo className="mt-0.5 h-4 w-4 shrink-0" />
          Le Pokédex régional de ce jeu n'est pas encore disponible dans la PokéAPI : toutes les espèces sont affichées. Coche simplement celles que tu possèdes.
        </div>
      )}
      {gd.sources && (
        <p className="mb-3 text-[11px] text-zinc-500">
          Pokédex utilisés : {gd.sources.join(" + ")}. Les espèces disponibles uniquement via HOME s'affichent avec « + hors dex régional ».
        </p>
      )}

      <Grid>
        {visible.map((s) => {
          const e = getEntry(dex, s.id, gid);
          const reg = gd.regional?.get(s.id);
          const off = !gd.set.has(s.id);
          return (
            <PokemonCard
              key={s.id}
              s={s}
              number={reg ? `N°${String(reg).padStart(3, "0")}` : undefined}
              caught={isFilled(e)}
              quickOn={e.caught}
              shiny={e.shinyCaught}
              event={!!e.eventRequired}
              quota={e.transferQuota}
              shinyQuota={e.shinyQuota || 0}
              sub={off ? "hors dex" : reg ? `#${String(s.id).padStart(4, "0")}` : null}
              accent={gs.border}
              onOpen={onOpen}
              onQuick={prefs.quickMode ? onQuick : undefined}
            />
          );
        })}
      </Grid>
      {more && <div ref={sentinel} className="py-8 text-center text-xs text-zinc-600">Chargement…</div>}
      {!list.length && <div className="py-16 text-center text-zinc-500">Aucun Pokémon ne correspond.</div>}

      {open && <EntryModal sid={open} gid={gid} regionalNumber={gd.regional?.get(open)} onClose={() => setOpen(null)} />}

      <Confirm
        open={bulk === true}
        title="Actions groupées"
        message={`Marquer les ${list.length} Pokémon actuellement affichés comme capturés dans ${game.name} ? (Les filtres et la recherche s'appliquent.)`}
        confirmLabel="Tout marquer capturé"
        danger={false}
        onConfirm={() => bulkSetCaught(gid, list.map((s) => s.id), true)}
        onClose={() => setBulk(null)}
      />
    </div>
  );
}
