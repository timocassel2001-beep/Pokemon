import { useCallback, useMemo, useState } from "react";
import { LuSearch, LuSparkles, LuTarget } from "react-icons/lu";
import { setPref, useStore } from "../lib/store.js";
import { goalFor, goalsSummary } from "../lib/stats.js";
import { Bar, Card, Chip, Sprite, cx, inputCls, matchSearch, pad, useData } from "../components/ui.jsx";
import { GoalCounter } from "../components/Goals.jsx";
import { useIncremental } from "../components/PokemonGrid.jsx";
import { EntryModal, NationalModal } from "../components/EntryModal.jsx";

const SHINY_GOALS = [
  ["none", "Aucun shiny"],
  ["species", "1 shiny par espèce"],
  ["games", "1 shiny par jeu où il existe"],
];

export default function Goals() {
  const { species, gameDex } = useData();
  const dex = useStore((s) => s.dex);
  const targets = useStore((s) => s.targets);
  const shinyGoal = useStore((s) => s.prefs.shinyGoal);
  const [q, setQ] = useState("");
  const [gen, setGen] = useState(0);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [sort, setSort] = useState("dex");
  const [open, setOpen] = useState(null);
  const [gameEntry, setGameEntry] = useState(null);

  const sum = useMemo(() => goalsSummary(species, dex, targets, gameDex, shinyGoal), [species, dex, targets, gameDex, shinyGoal]);

  const rows = useMemo(() => {
    let r = species
      .filter((s) => (!gen || s.gen === gen) && matchSearch(s, q))
      .map((s) => ({ s, g: goalFor(s.id, dex, targets, gameDex, shinyGoal) }));
    if (onlyMissing) r = r.filter((x) => x.g.missNormal || x.g.missShiny);
    if (sort === "missing") r.sort((a, b) => b.g.missNormal + b.g.missShiny - (a.g.missNormal + a.g.missShiny) || a.s.id - b.s.id);
    return r;
  }, [species, gen, q, dex, targets, gameDex, shinyGoal, onlyMissing, sort]);

  const { visible, more, sentinel } = useIncremental(rows, 120);
  const onOpen = useCallback((id) => setOpen(id), []);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="mb-1 flex justify-between text-sm"><span className="text-zinc-400">Exemplaires normaux</span><span className="tabular-nums text-zinc-100">{sum.haveN} / {sum.needN}</span></div>
          <Bar value={sum.haveN} max={sum.needN} color="bg-emerald-500" />
          <p className="mt-2 text-xs text-zinc-500">Il en manque {sum.needN - sum.haveN}.</p>
        </Card>
        <Card className="p-4">
          <div className="mb-1 flex justify-between text-sm"><span className="flex items-center gap-1 text-zinc-400"><LuSparkles className="h-3.5 w-3.5 text-amber-300" /> Exemplaires shiny</span><span className="tabular-nums text-zinc-100">{sum.haveS} / {sum.needS}</span></div>
          <Bar value={sum.haveS} max={sum.needS || 1} color="bg-amber-400" />
          <p className="mt-2 text-xs text-zinc-500">{sum.needS ? `Il en manque ${sum.needS - sum.haveS}.` : "Aucun objectif shiny pour l'instant."}</p>
        </Card>
        <Card className="p-4">
          <div className="mb-1 flex justify-between text-sm"><span className="flex items-center gap-1 text-zinc-400"><LuTarget className="h-3.5 w-3.5" /> Espèces terminées</span><span className="tabular-nums text-zinc-100">{sum.done} / {species.length}</span></div>
          <Bar value={sum.done} max={species.length} color="bg-violet-500" />
          <p className="mt-2 text-xs text-zinc-500">Objectifs normal ET shiny atteints.</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-2 text-sm font-medium text-zinc-200">Comment sont calculés les objectifs</div>
        <p className="mb-3 text-xs leading-relaxed text-zinc-400">
          <b className="text-zinc-300">Normal :</b> par défaut, autant d'exemplaires que de jeux suivis où l'espèce existe (ex. Bulbizarre présent dans 14 jeux → 14 à capturer).
          <b className="text-zinc-300"> Possédés :</b> cases remplies dans chaque jeu + exemplaires « en plus » notés pour le transfert.
          Tu peux changer l'objectif d'une espèce avec − / + ; <span className="text-sky-400">↺</span> revient au calcul automatique.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">Objectif shiny par défaut :</span>
          {SHINY_GOALS.map(([k, l]) => <Chip key={k} active={shinyGoal === k} onClick={() => setPref("shinyGoal", k)}>{l}</Chip>)}
        </div>
      </Card>

      <div className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input className={cx(inputCls, "pl-9")} placeholder="Nom ou numéro…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Chip active={onlyMissing} onClick={() => setOnlyMissing(!onlyMissing)}>Seulement les objectifs non atteints</Chip>
          <Chip active={sort === "missing"} onClick={() => setSort(sort === "missing" ? "dex" : "missing")}>Trier par manquants</Chip>
          <span className="text-xs tabular-nums text-zinc-500">{rows.length} espèce(s)</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          <Chip active={gen === 0} onClick={() => setGen(0)}>Toutes gén.</Chip>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => <Chip key={g} active={gen === g} onClick={() => setGen(g)}>Gen {g}</Chip>)}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <div className="hidden grid-cols-[minmax(0,1fr)_200px_200px_140px] gap-3 bg-zinc-900 px-3 py-2 text-xs text-zinc-500 md:grid">
          <span>Pokémon</span><span>Normal (possédés / objectif)</span><span>Shiny (possédés / objectif)</span><span>Reste à capturer</span>
        </div>
        {visible.map(({ s, g }) => (
          <div key={s.id} className="card-cv grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-zinc-800/70 bg-zinc-950 px-3 py-1.5 md:grid-cols-[minmax(0,1fr)_200px_200px_140px]">
            <button onClick={() => onOpen(s.id)} className="flex min-w-0 items-center gap-2 text-left">
              <Sprite id={s.id} size={40} dim={!g.haveNormal && !g.haveShiny} />
              <div className="min-w-0">
                <div className="truncate text-sm text-zinc-100 hover:underline">{s.fr}</div>
                <div className="text-[11px] text-zinc-500">#{pad(s.id)} · {g.nGames} jeu(x)</div>
              </div>
            </button>
            <GoalCounter sid={s.id} kind="normal" goal={g} />
            <div className="col-start-2 md:col-start-auto"><GoalCounter sid={s.id} kind="shiny" goal={g} /></div>
            <div className="col-span-2 text-xs md:col-span-1">
              {g.missNormal || g.missShiny ? (
                <span className="text-zinc-300">
                  {g.missNormal > 0 && <span>{g.missNormal} normal</span>}
                  {g.missNormal > 0 && g.missShiny > 0 && " · "}
                  {g.missShiny > 0 && <span className="text-amber-300">{g.missShiny} shiny</span>}
                </span>
              ) : (
                <span className="text-emerald-400">Terminé ✓</span>
              )}
            </div>
          </div>
        ))}
        {!rows.length && <div className="bg-zinc-950 py-12 text-center text-sm text-zinc-500">{onlyMissing ? "Tous les objectifs affichés sont atteints 🎉" : "Aucun Pokémon ne correspond."}</div>}
      </div>
      {more && <div ref={sentinel} className="py-6 text-center text-xs text-zinc-600">Chargement…</div>}

      {open && !gameEntry && <NationalModal sid={open} onClose={() => setOpen(null)} onOpenGame={(sid, gid) => setGameEntry({ sid, gid })} />}
      {gameEntry && <EntryModal sid={gameEntry.sid} gid={gameEntry.gid} onClose={() => setGameEntry(null)} />}
    </div>
  );
}
