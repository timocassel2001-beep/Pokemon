import { useMemo } from "react";
import { LuArchive, LuArrowRightLeft, LuCalendarClock, LuSparkles, LuTarget, LuTrophy } from "react-icons/lu";
import { GAMES, genStyle } from "../data/games.js";
import { useStore } from "../lib/store.js";
import { computeStats, goalsSummary } from "../lib/stats.js";
import { Bar, Card, Ring, cx, useData } from "../components/ui.jsx";

function Stat({ icon: Icon, label, value, sub, tone = "text-emerald-400" }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-800", tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold tabular-nums text-zinc-50">{value}</div>
        <div className="truncate text-xs text-zinc-400">{label}</div>
        {sub && <div className="truncate text-[11px] text-zinc-500">{sub}</div>}
      </div>
    </Card>
  );
}

export default function Dashboard({ go }) {
  const { species, gameDex, hackGames } = useData();
  const dex = useStore((s) => s.dex);
  const vault = useStore((s) => s.vault);
  const targets = useStore((s) => s.targets);
  const shinyGoal = useStore((s) => s.prefs.shinyGoal);
  const st = useMemo(() => computeStats(dex, gameDex, species.length), [dex, gameDex, species.length]);
  const goals = useMemo(() => goalsSummary(species, dex, targets, gameDex, shinyGoal), [species, dex, targets, gameDex, shinyGoal]);
  const total = species.length;
  const allMons = vault.banks.flatMap((b) => b.mons);
  const thr = Object.fromEntries(vault.hacks.map((h) => [h.id, h.shinyThreshold ?? 8]));
  const bankShiny = allMons.filter((m) => m.shiny || (m.pid != null && m.tid != null && m.sid != null && ((m.tid ^ m.sid ^ (m.pid >>> 16) ^ (m.pid & 0xffff)) & 0xffff) < thr[m.hack])).length;
  const bankSpecies = new Set(allMons.map((m) => m.species).filter(Boolean)).size;

  const games = GAMES;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col items-center gap-3 lg:col-span-1">
          <div className="text-sm font-medium text-zinc-400">Pokédex National</div>
          <Ring value={st.nationalCaught} max={total} sub={`${st.nationalCaught} / ${total} espèces`} />
          <p className="text-center text-xs text-zinc-500">Espèces capturées dans au moins un jeu</p>
        </Card>
        <Card className="flex flex-col items-center gap-3">
          <div className="text-sm font-medium text-zinc-400">Shiny</div>
          <Ring value={st.nationalShiny} max={total} color="#fcd34d" sub={`${st.nationalShiny} / ${total} espèces`} />
          <p className="text-center text-xs text-zinc-500">Espèces obtenues chromatiques au moins une fois</p>
        </Card>
        <Card className="flex flex-col items-center gap-3">
          <div className="text-sm font-medium text-zinc-400">Master Living Dex</div>
          <Ring value={st.masterCaught} max={st.masterTotal} color="#a78bfa" sub={`${st.masterCaught} / ${st.masterTotal} cases`} />
          <p className="text-center text-xs text-zinc-500">Toutes les cases de tous les jeux réunies</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={LuTrophy} label="Captures enregistrées" value={st.totalCaptures} />
        <Stat icon={LuArrowRightLeft} label="Exemplaires à transférer" value={st.totalTransfers} tone="text-sky-400" />
        <Stat icon={LuCalendarClock} label="Notes d'obtention / events" value={st.eventCount} tone="text-fuchsia-400" />
        <Stat icon={LuArchive} label={`Pokémon en Banque (${vault.banks.length} banque${vault.banks.length > 1 ? "s" : ""})`} value={allMons.length} sub={`${bankSpecies} espèces · ${bankShiny} shiny`} tone="text-amber-300" />
      </div>

      <Card>
        <button onClick={() => go("objectifs")} className="w-full text-left">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-zinc-100"><LuTarget className="h-4 w-4 text-violet-400" /> Objectifs de captures</h2>
            <span className="text-xs text-zinc-500">{goals.done} / {species.length} espèces terminées · voir le détail</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 flex justify-between text-sm"><span className="text-zinc-400">Normaux</span><span className="tabular-nums text-zinc-200">{goals.haveN} / {goals.needN}</span></div>
              <Bar value={goals.haveN} max={goals.needN} color="bg-emerald-500" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm"><span className="text-zinc-400">Shiny</span><span className="tabular-nums text-zinc-200">{goals.haveS} / {goals.needS}</span></div>
              <Bar value={goals.haveS} max={goals.needS || 1} color="bg-amber-400" />
            </div>
          </div>
        </button>
      </Card>

      {hackGames.length > 0 && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-100">Dex des ROM hacks</h2>
            <span className="text-xs text-zinc-500">Suivi à part, hors Master Living Dex officiel</span>
          </div>
          <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {hackGames.map((g) => {
              const ids = gameDex[g.id].ids;
              const caught = ids.filter((id) => dex[id]?.[g.id]?.caught || dex[id]?.[g.id]?.shinyCaught).length;
              const shiny = ids.filter((id) => dex[id]?.[g.id]?.shinyCaught).length;
              return (
                <button key={g.id} onClick={() => go("jeux", g.id.replace(":", "_"))} className="rounded-lg p-1.5 text-left hover:bg-zinc-800/60">
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-zinc-200">{g.name} <span className="text-[10px] text-teal-300">{g.region}</span></span>
                    <span className="shrink-0 tabular-nums text-xs text-zinc-400">{caught}/{ids.length}<span className="ml-2 text-amber-300">★{shiny}/{ids.length}</span></span>
                  </div>
                  <Bar value={caught} max={ids.length} color="bg-teal-500" thin />
                  <Bar value={shiny} max={ids.length} color="bg-amber-400" thin className="mt-1" />
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-100">Progression par jeu</h2>
          <span className="text-xs text-zinc-500">Cliquer pour ouvrir le jeu</span>
        </div>
        <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
          {games.map((g) => {
            const p = st.perGame[g.id];
            const gs = genStyle(g.gen);
            const pct = p.total ? (p.caught / p.total) * 100 : 0;
            return (
              <button key={g.id} onClick={() => go("jeux", g.id)} className="group rounded-lg p-1.5 text-left hover:bg-zinc-800/60">
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", gs.bg)} />
                    <span className="truncate text-zinc-200 group-hover:text-white">{g.name}</span>
                    <span className={cx("text-[10px] font-semibold", gs.text)}>{gs.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-xs text-zinc-400">
                    {p.caught}/{p.total} · <span className="text-zinc-200">{pct.toFixed(1)}%</span>
                    {p.shiny > 0 && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-amber-300">
                        <LuSparkles className="h-3 w-3" />
                        {p.shiny}
                      </span>
                    )}
                  </span>
                </div>
                <Bar value={p.caught} max={p.total} color={gs.bg} thin />
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
