import { useEffect, useState } from "react";
import { LuCheck, LuMinus, LuPlus, LuSparkles } from "react-icons/lu";
import { GAMES, GAME_BY_ID, genStyle } from "../data/games.js";
import { getEntry, isFilled, updateEntry, useStore } from "../lib/store.js";
import { GoalBox } from "./Goals.jsx";
import { Field, Modal, ShinyStar, Sprite, cx, inputCls, pad, useData } from "./ui.jsx";

const SUGGESTIONS = ["Capture", "Échange", "Reproduction", "Évolution", "Événement", "Ticket Mystique", "Faille DNS", "Cadeau", "Fossile", "Événement PKHeX", "HOME", "Pokéwalker", "Raid Dynamax"];

function Toggle({ on, onClick, icon: Icon, label, tone }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
        on ? tone : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function QuotaRow({ label, value, tone, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-zinc-300">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(value - 1)} disabled={!value} className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30" aria-label={`Moins ${label}`}>
          <LuMinus className="h-4 w-4" />
        </button>
        <span className={cx("w-8 text-center text-lg font-bold tabular-nums", tone)}>{value}</span>
        <button onClick={() => onChange(value + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800" aria-label={`Plus ${label}`}>
          <LuPlus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function EntryEditor({ sid, gid }) {
  const dex = useStore((s) => s.dex);
  const e = getEntry(dex, sid, gid);
  const [note, setNote] = useState(e.eventRequired ?? "");
  useEffect(() => setNote(e.eventRequired ?? ""), [sid, gid]); // eslint-disable-line

  const commitNote = (v) => updateEntry(sid, gid, { eventRequired: v.trim() || null });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Toggle on={e.caught} onClick={() => updateEntry(sid, gid, { caught: !e.caught })} icon={LuCheck} label="Capturé (normal)" tone="border-emerald-400 bg-emerald-500/15 text-emerald-300" />
        <Toggle on={e.shinyCaught} onClick={() => updateEntry(sid, gid, { shinyCaught: !e.shinyCaught })} icon={LuSparkles} label="Shiny capturé" tone="border-amber-300 bg-amber-400/15 text-amber-200" />
      </div>

      <p className="-mt-2 text-[11px] text-zinc-500">Normal et shiny sont comptés séparément : coche les deux si tu as les deux dans ce jeu.</p>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
        <div className="text-sm font-medium text-zinc-200">Quota de transfert</div>
        <div className="mb-2 text-xs text-zinc-500">Exemplaires en plus, capturés ici pour les envoyer vers d'autres jeux</div>
        <QuotaRow label="Normaux" value={e.transferQuota} tone="text-sky-300" onChange={(v) => updateEntry(sid, gid, { transferQuota: v })} />
        <QuotaRow label="Shiny" value={e.shinyQuota || 0} tone="text-amber-300" onChange={(v) => updateEntry(sid, gid, { shinyQuota: v })} />
      </div>

      <Field label="Méthode d'obtention / Événement">
        <input
          className={inputCls}
          value={note}
          placeholder="ex : Échange, Ticket Mystique, Faille DNS…"
          onChange={(ev) => setNote(ev.target.value)}
          onBlur={(ev) => commitNote(ev.target.value)}
          onKeyDown={(ev) => ev.key === "Enter" && ev.currentTarget.blur()}
        />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => { setNote(s); commitNote(s); }} className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] text-zinc-400 hover:border-fuchsia-400 hover:text-fuchsia-300">
            {s}
          </button>
        ))}
        {note && (
          <button onClick={() => { setNote(""); commitNote(""); }} className="rounded-full px-2.5 py-0.5 text-[11px] text-red-400 hover:bg-red-500/10">
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}

export function EntryModal({ sid, gid, onClose, regionalNumber }) {
  const { byId, gameById } = useData();
  const dex = useStore((s) => s.dex);
  if (!sid) return null;
  const s = byId[sid];
  const g = gameById[gid] ?? GAME_BY_ID[gid];
  const e = getEntry(dex, sid, gid);
  const gs = genStyle(g.gen);
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-bold", gs.soft, gs.text)}>{g.name}</span>
          <span className="truncate">{s.fr}</span>
        </span>
      }
    >
      <div className="mb-5 flex items-center gap-4">
        <div className="relative rounded-2xl bg-zinc-950 p-2">
          <Sprite id={sid} shiny={e.shinyCaught} size={96} dim={!isFilled(e)} />
          {e.shinyCaught && <ShinyStar className="absolute right-2 top-2 h-5 w-5" />}
        </div>
        <div>
          <div className="text-xl font-bold text-zinc-50">{s.fr}</div>
          <div className="text-sm text-zinc-400">
            {s.en} · #{pad(sid)}
            {regionalNumber ? ` · Dex régional n°${regionalNumber}` : ""}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Génération {s.gen}{s.legendary ? " · Légendaire" : ""}{s.mythical ? " · Fabuleux" : ""}</div>
        </div>
      </div>
      <EntryEditor sid={sid} gid={gid} />
      {!g.isHack && <div className="mt-4"><GoalBox sid={sid} /></div>}
    </Modal>
  );
}

/** Vue nationale : récapitulatif de l'espèce dans tous les jeux. */
export function NationalModal({ sid, onClose, onOpenGame }) {
  const { byId, gameDex } = useData();
  const dex = useStore((s) => s.dex);
  if (!sid) return null;
  const s = byId[sid];
  const games = dex[sid] ?? {};
  const anyShiny = Object.values(games).some((e) => e.shinyCaught);
  return (
    <Modal open onClose={onClose} wide title={<span>#{pad(sid)} · {s.fr}</span>}>
      <div className="mb-4"><GoalBox sid={sid} /></div>
      <div className="mb-5 flex items-center gap-4">
        <div className="relative rounded-2xl bg-zinc-950 p-2">
          <Sprite id={sid} shiny={anyShiny} size={96} />
          {anyShiny && <ShinyStar className="absolute right-2 top-2 h-5 w-5" />}
        </div>
        <div>
          <div className="text-xl font-bold text-zinc-50">{s.fr}</div>
          <div className="text-sm text-zinc-400">{s.en} · Génération {s.gen}</div>
          <a href={`#guide-pokemon-${sid}`} onClick={onClose} className="mt-1 inline-block text-xs text-violet-300 hover:underline">Fiche complète : disponibilité par jeu, évolutions →</a>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-950 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Jeu</th>
              <th className="px-2 py-2 text-center font-medium">Capturé</th>
              <th className="px-2 py-2 text-center font-medium">Shiny</th>
              <th className="px-2 py-2 text-center font-medium">En plus</th>
              <th className="px-3 py-2 font-medium">Méthode</th>
            </tr>
          </thead>
          <tbody>
            {GAMES.map((g) => {
              const available = gameDex[g.id].set.has(sid);
              const e = getEntry(dex, sid, g.id);
              const gs = genStyle(g.gen);
              if (!available && !isFilled(e))
                return (
                  <tr key={g.id} className="border-t border-zinc-800/70 text-zinc-600">
                    <td className="px-3 py-1.5">
                      <span className={cx("mr-2 inline-block h-2 w-2 rounded-full opacity-40", gs.bg)} />
                      {g.name}
                    </td>
                    <td colSpan={4} className="px-3 py-1.5 text-xs italic">Absent du Pokédex de ce jeu</td>
                  </tr>
                );
              return (
                <tr key={g.id} className="border-t border-zinc-800/70 hover:bg-zinc-800/40">
                  <td className="px-3 py-1.5">
                    <button onClick={() => onOpenGame(sid, g.id)} className="text-left text-zinc-200 hover:text-white hover:underline">
                      <span className={cx("mr-2 inline-block h-2 w-2 rounded-full", gs.bg)} />
                      {g.name}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => updateEntry(sid, g.id, { caught: !e.caught })} className={cx("grid h-6 w-6 place-items-center rounded-md border mx-auto", e.caught ? "border-emerald-400 bg-emerald-500 text-zinc-950" : "border-zinc-700 text-transparent hover:border-emerald-400")} aria-label={`Capturé dans ${g.name}`}>
                      <LuCheck className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => updateEntry(sid, g.id, { shinyCaught: !e.shinyCaught })} className={cx("grid h-6 w-6 place-items-center rounded-md border mx-auto", e.shinyCaught ? "border-amber-300 bg-amber-400 text-zinc-950" : "border-zinc-700 text-transparent hover:border-amber-300")} aria-label={`Shiny dans ${g.name}`}>
                      <LuSparkles className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs tabular-nums"><span className="text-sky-300">{e.transferQuota || ""}</span>{e.shinyQuota ? <span className="ml-1 text-amber-300">★{e.shinyQuota}</span> : null}</td>
                  <td className="max-w-[10rem] truncate px-3 py-1.5 text-xs text-fuchsia-300">{e.eventRequired ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
