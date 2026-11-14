import { GuideByGame, PokemonSheet } from "../components/GameGuide.jsx";
import { cx } from "../components/ui.jsx";

/** Onglet « Guide des jeux » : #guide, #guide-jeu-<jeu>, #guide-pokemon-<n°> */
export default function Guide({ gameId }) {
  const arg = gameId ?? "";
  const [mode, value] = arg.startsWith("pokemon-") ? ["pokemon", Number(arg.slice(8))] : ["jeu", arg.startsWith("jeu-") ? arg.slice(4) : "platinum"];
  const go = (h) => { window.location.hash = h; };
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-zinc-800">
        {[["jeu", "Par jeu : évolutions & Pokémon à faire venir"], ["pokemon", "Par Pokémon : fiche complète"]].map(([k, l]) => (
          <button key={k} onClick={() => go(k === "jeu" ? `guide-jeu-${mode === "jeu" ? value : "platinum"}` : `guide-pokemon-${mode === "pokemon" ? value : 25}`)}
            className={cx("-mb-px border-b-2 px-3 py-2 text-sm", mode === k ? "border-emerald-400 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300")}>{l}</button>
        ))}
      </div>
      {mode === "jeu" ? (
        <GuideByGame gid={value || "platinum"} setGid={(g) => go(`guide-jeu-${g}`)} openPokemon={(sp) => go(`guide-pokemon-${sp}`)} />
      ) : (
        <PokemonSheet species={value || 25} setSpecies={(sp) => go(`guide-pokemon-${sp}`)} openGame={(g) => go(`guide-jeu-${g}`)} />
      )}
    </div>
  );
}
