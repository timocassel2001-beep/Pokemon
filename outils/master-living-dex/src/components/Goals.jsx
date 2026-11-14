import { LuMinus, LuPlus, LuRotateCcw, LuSparkles } from "react-icons/lu";
import { setTarget, useStore } from "../lib/store.js";
import { goalFor } from "../lib/stats.js";
import { cx, useData } from "./ui.jsx";

export function GoalCounter({ sid, kind, goal, compact = false }) {
  const need = kind === "normal" ? goal.needNormal : goal.needShiny;
  const have = kind === "normal" ? goal.haveNormal : goal.haveShiny;
  const custom = kind === "normal" ? goal.customNormal : goal.customShiny;
  const done = have >= need;
  const shiny = kind === "shiny";
  return (
    <div className={cx("flex items-center gap-1.5", compact && "gap-1")}>
      {shiny && <LuSparkles className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
      <span className={cx("min-w-[3.2rem] text-right tabular-nums text-sm", done && need > 0 ? "text-emerald-300" : need === 0 ? "text-zinc-600" : "text-zinc-200")}>
        {have}<span className="text-zinc-500">/{need}</span>
      </span>
      <button onClick={() => setTarget(sid, kind, Math.max(0, need - 1))} className="grid h-6 w-6 place-items-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label={`Baisser l'objectif ${kind}`}>
        <LuMinus className="h-3 w-3" />
      </button>
      <button onClick={() => setTarget(sid, kind, need + 1)} className="grid h-6 w-6 place-items-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label={`Augmenter l'objectif ${kind}`}>
        <LuPlus className="h-3 w-3" />
      </button>
      {custom ? (
        <button onClick={() => setTarget(sid, kind, null)} className="grid h-6 w-6 place-items-center rounded-md text-sky-400 hover:bg-zinc-800" title="Revenir à l'objectif automatique">
          <LuRotateCcw className="h-3 w-3" />
        </button>
      ) : (
        <span className="w-6" />
      )}
    </div>
  );
}

/** Bloc récapitulatif utilisé dans les fenêtres d'un Pokémon. */
export function GoalBox({ sid }) {
  const { gameDex } = useData();
  const dex = useStore((s) => s.dex);
  const targets = useStore((s) => s.targets);
  const shinyGoal = useStore((s) => s.prefs.shinyGoal);
  const g = goalFor(sid, dex, targets, gameDex, shinyGoal);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium text-zinc-200">Objectif de captures (tous jeux)</span>
        <span className="text-[11px] text-zinc-500">présent dans {g.nGames} jeu(x) suivi(s)</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">Normal <GoalCounter sid={sid} kind="normal" goal={g} /></div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">Shiny <GoalCounter sid={sid} kind="shiny" goal={g} /></div>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Possédés = cases remplies dans les jeux + exemplaires en plus à transférer.
        {g.missNormal || g.missShiny ? ` Il manque ${g.missNormal ? `${g.missNormal} normal` : ""}${g.missNormal && g.missShiny ? " et " : ""}${g.missShiny ? `${g.missShiny} shiny` : ""}.` : " Objectif atteint !"}
      </p>
    </div>
  );
}
