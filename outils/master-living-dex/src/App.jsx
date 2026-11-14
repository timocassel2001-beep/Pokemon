import { useCallback, useEffect, useMemo, useState } from "react";
import { LuArchive, LuBookOpen, LuGamepad2, LuLayoutDashboard, LuLoader, LuRefreshCw, LuMap, LuScanSearch, LuSettings, LuTarget, LuTriangleAlert } from "react-icons/lu";
import { GAMES, computeGameDex } from "./data/games.js";
import { hackGames } from "./data/hackGames.js";
import { loadPokeData, readCachedData } from "./data/pokedata.js";
import { getSaveError, useStore } from "./lib/store.js";
import { Btn, DataContext, Toast, cx } from "./components/ui.jsx";
import Dashboard from "./views/Dashboard.jsx";
import National from "./views/National.jsx";
import GameDex from "./views/GameDex.jsx";
import Bank from "./views/Bank.jsx";
import Goals from "./views/Goals.jsx";
import Analyzer from "./views/Analyzer.jsx";
import Guide from "./views/Guide.jsx";
import Settings from "./views/Settings.jsx";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LuLayoutDashboard },
  { id: "national", label: "Pokédex National", icon: LuBookOpen },
  { id: "jeux", label: "Pokédex par jeu", icon: LuGamepad2 },
  { id: "objectifs", label: "Objectifs de captures", icon: LuTarget },
  { id: "guide", label: "Guide des jeux", icon: LuMap },
  { id: "banque", label: "Banque", icon: LuArchive },
  { id: "analyseur", label: "Analyseur de sauvegarde", icon: LuScanSearch },
  { id: "parametres", label: "Paramètres", icon: LuSettings },
];

function parseHash() {
  const h = window.location.hash.replace(/^#/, "");
  const [view, ...rest] = h.split("-");
  const arg = rest.join("-") || null;
  return { view: NAV.some((n) => n.id === view) ? view : "dashboard", arg: arg?.startsWith("hack_") ? arg.replace("hack_", "hack:") : arg };
}

export default function App() {
  const [data, setData] = useState(() => readCachedData());
  const [progress, setProgress] = useState("Connexion à la PokéAPI…");
  const [error, setError] = useState(null);
  const [route, setRoute] = useState(parseHash);
  const [toast, setToast] = useState(null);
  useStore((s) => s.dex); // re-rendu pour l'alerte de stockage
  const hacks = useStore((s) => s.vault.hacks);
  const saveError = getSaveError();

  const load = useCallback(async (force = false) => {
    setError(null);
    try {
      const d = await loadPokeData({ force, onProgress: setProgress });
      setData(d);
    } catch (e) {
      setError(e.message || String(e));
      throw e;
    }
  }, []);

  useEffect(() => {
    if (!data) load().catch(() => {});
  }, []); // eslint-disable-line

  useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const go = useCallback((view, arg) => {
    window.location.hash = arg ? `${view}-${arg}` : view;
  }, []);

  const ctx = useMemo(() => {
    if (!data) return null;
    const byId = Object.fromEntries(data.species.map((s) => [s.id, s]));
    const gameDex = {};
    const hGames = hackGames(hacks);
    for (const g of [...GAMES, ...hGames]) {
      const r = computeGameDex(g, data);
      gameDex[g.id] = { ...r, set: new Set(r.ids) };
    }
    const gameById = Object.fromEntries([...GAMES, ...hGames].map((g) => [g.id, g]));
    return { species: data.species, byId, gameDex, dexes: data.dexes ?? {}, hackGames: hGames, gameById, meta: { fetchedAt: data.fetchedAt, source: data.source }, reload: () => load(true) };
  }, [data, load, hacks]);

  if (!ctx)
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-950 p-6 text-zinc-200">
        <div className="max-w-md text-center">
          {error ? (
            <>
              <LuTriangleAlert className="mx-auto mb-3 h-10 w-10 text-amber-400" />
              <h1 className="mb-2 text-lg font-semibold">Impossible de charger la liste des Pokémon</h1>
              <p className="mb-4 text-sm text-zinc-400">
                La PokéAPI n'a pas répondu ({error}). Vérifie ta connexion internet : il faut être en ligne au premier lancement, ensuite tout est gardé en cache.
              </p>
              <Btn variant="primary" onClick={() => load().catch(() => {})}><LuRefreshCw className="h-4 w-4" /> Réessayer</Btn>
            </>
          ) : (
            <>
              <LuLoader className="mx-auto mb-3 h-10 w-10 animate-spin text-emerald-400" />
              <h1 className="mb-1 text-lg font-semibold">Master Living Dex</h1>
              <p className="text-sm text-zinc-400">{progress}</p>
              <p className="mt-2 text-xs text-zinc-600">Premier lancement seulement : les données sont ensuite gardées en cache.</p>
            </>
          )}
        </div>
      </div>
    );

  const View = { dashboard: Dashboard, national: National, jeux: GameDex, objectifs: Goals, guide: Guide, banque: Bank, analyseur: Analyzer, parametres: Settings }[route.view];
  const current = NAV.find((n) => n.id === route.view);

  return (
    <DataContext.Provider value={ctx}>
      <div className="min-h-screen bg-zinc-950 text-zinc-200 md:flex">
        <aside className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
          <div className="hidden items-center gap-2.5 px-5 py-5 md:flex">
            <div className="relative h-8 w-8 rounded-full border-2 border-zinc-200 bg-gradient-to-b from-red-500 from-50% to-zinc-100 to-50%">
              <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-800 bg-zinc-100" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight text-zinc-50">Master Living Dex</div>
              <div className="text-[11px] text-zinc-500">Tracker local</div>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-col md:px-3">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className={cx(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                  route.view === n.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                )}
              >
                <n.icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{n.label}</span>
              </button>
            ))}
          </nav>
          {ctx.meta.source === "rest" && (
            <p className="mx-3 mt-2 hidden rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-200 md:block">Mode dégradé : noms anglais et Pokédex régionaux indisponibles. Réessaie depuis Paramètres.</p>
          )}
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-16 pt-4 md:px-6 md:pt-6">
          {saveError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              <LuTriangleAlert className="h-4 w-4" /> {saveError}
            </div>
          )}
          {route.view !== "jeux" && <h1 className="mb-5 text-2xl font-bold text-zinc-50">{current.label}</h1>}
          <View go={go} gameId={route.view === "jeux" || route.view === "guide" ? route.arg : null} toast={setToast} />
        </main>
      </div>
      <Toast msg={toast} onDone={() => setToast(null)} />
    </DataContext.Provider>
  );
}
