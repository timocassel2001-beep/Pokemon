import { useCallback, useMemo, useState } from "react";
import { LuSearch } from "react-icons/lu";
import { GAMES, genStyle } from "../data/games.js";
import { useStore } from "../lib/store.js";
import { aggregate, goalFor } from "../lib/stats.js";
import { Chip, cx, inputCls, matchSearch, useData } from "../components/ui.jsx";
import { Grid, PokemonCard, useIncremental } from "../components/PokemonGrid.jsx";
import { EntryModal, NationalModal } from "../components/EntryModal.jsx";

const STATUS = [
  ["all", "Tous"],
  ["missing", "Jamais capturés"],
  ["caught", "Capturés"],
  ["partial", "Manque dans un jeu"],
  ["shiny", "Shiny"],
  ["event", "Avec note / event"],
  ["goal", "Objectif non atteint"],
];

function GameDots({ sid, games, gameDex }) {
  return (
    <div className="mt-1 flex w-full flex-wrap justify-center gap-[2px] px-1">
      {GAMES.map((g) => {
        if (!gameDex[g.id].set.has(sid)) return null;
        const e = games?.[g.id];
        const ok = e?.caught || e?.shinyCaught;
        return <span key={g.id} title={`${g.name} : ${ok ? "capturé" : "manquant"}`} className={cx("h-1.5 w-2 rounded-sm", ok ? genStyle(g.gen).bg : "bg-zinc-800")} />;
      })}
    </div>
  );
}

export default function National() {
  const { species, gameDex } = useData();
  const dex = useStore((s) => s.dex);
  const targets = useStore((s) => s.targets);
  const shinyGoal = useStore((s) => s.prefs.shinyGoal);
  const [q, setQ] = useState("");
  const [gen, setGen] = useState(0);
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(null);
  const [gameEntry, setGameEntry] = useState(null);

  const list = useMemo(() => {
    return species.filter((s) => {
      if (gen && s.gen !== gen) return false;
      if (!matchSearch(s, q)) return false;
      if (status === "all") return true;
      const a = aggregate(dex[s.id]);
      if (status === "missing") return a.caughtGames === 0;
      if (status === "caught") return a.caughtGames > 0;
      if (status === "shiny") return a.shiny;
      if (status === "event") return a.event;
      if (status === "partial") return GAMES.some((g) => gameDex[g.id].set.has(s.id) && !(dex[s.id]?.[g.id]?.caught || dex[s.id]?.[g.id]?.shinyCaught));
      if (status === "goal") { const g = goalFor(s.id, dex, targets, gameDex, shinyGoal); return g.missNormal > 0 || g.missShiny > 0; }
      return true;
    });
  }, [species, dex, q, gen, status, gameDex, targets, shinyGoal]);

  const { visible, more, sentinel } = useIncremental(list);
  const onOpen = useCallback((id) => setOpen(id), []);

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 mb-4 space-y-3 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input className={cx(inputCls, "pl-9")} placeholder="Rechercher par nom (FR/EN) ou numéro…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <span className="text-xs tabular-nums text-zinc-500">{list.length} résultat(s)</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Chip active={gen === 0} onClick={() => setGen(0)}>Toutes gén.</Chip>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
            <Chip key={g} active={gen === g} onClick={() => setGen(g)}>Gen {g}</Chip>
          ))}
          <span className="mx-1 w-px shrink-0 bg-zinc-800" />
          {STATUS.map(([k, l]) => (
            <Chip key={k} active={status === k} onClick={() => setStatus(k)}>{l}</Chip>
          ))}
        </div>
      </div>

      <Grid>
        {visible.map((s) => {
          const a = aggregate(dex[s.id]);
          const g = goalFor(s.id, dex, targets, gameDex, shinyGoal);
          return (
            <PokemonCard
              key={s.id}
              s={s}
              caught={a.caughtGames > 0}
              shiny={a.shiny}
              event={a.event}
              sub={
                <span>
                  Capturé au total {a.copies} fois
                  <br />
                  <span className={g.missNormal ? "text-zinc-400" : "text-emerald-400"}>{g.haveNormal}/{g.needNormal}</span>
                  {g.needShiny > 0 && <span className={g.missShiny ? "ml-1.5 text-amber-200/70" : "ml-1.5 text-amber-300"}>★{g.haveShiny}/{g.needShiny}</span>}
                </span>
              }
              onOpen={onOpen}
              footer={<GameDots sid={s.id} games={dex[s.id]} gameDex={gameDex} />}
            />
          );
        })}
      </Grid>
      {more && <div ref={sentinel} className="py-8 text-center text-xs text-zinc-600">Chargement…</div>}
      {!list.length && <div className="py-16 text-center text-zinc-500">Aucun Pokémon ne correspond.</div>}

      {open && !gameEntry && <NationalModal sid={open} onClose={() => setOpen(null)} onOpenGame={(sid, gid) => setGameEntry({ sid, gid })} />}
      {gameEntry && <EntryModal sid={gameEntry.sid} gid={gameEntry.gid} onClose={() => setGameEntry(null)} />}
    </div>
  );
}
