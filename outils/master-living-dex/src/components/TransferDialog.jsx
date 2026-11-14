import { useMemo, useState } from "react";
import { LuArrowRight, LuBan, LuCheck, LuInfo, LuRefreshCw, LuTriangleAlert } from "react-icons/lu";
import { GAMES, genStyle } from "../data/games.js";
import { OFFICIAL_META, STATUS_LABEL, evaluateTransfer } from "../lib/officialTransfer.js";
import { applyTransfers } from "../lib/store.js";
import { b64ToBytes, bytesToB64, gen1ToGen2, parseGB } from "../lib/pkm.js";
import { recordFromParsed } from "../lib/bank.js";
import { Btn, Modal, Sprite, cx, useData } from "./ui.jsx";

const STATUS_STYLE = {
  same: "text-zinc-500",
  file: "text-emerald-300",
  convert: "text-emerald-300",
  track: "text-sky-300",
  impossible: "text-red-400",
};
const OFFICIAL_GAMES = GAMES.filter((g) => OFFICIAL_META[g.id]);

/** Données modifiées par un transfert : seule la Time Capsule Gen 1 → Gen 2 convertit le fichier. */
export function transferPatch(mon, to, status, byId) {
  if (status !== "convert") return null;
  const raw2 = gen1ToGen2(b64ToBytes(mon.raw));
  const { mon: rec } = recordFromParsed(parseGB(2, raw2), byId, mon.fileName);
  return { ...rec, raw: bytesToB64(raw2), notes: mon.notes, nickname: rec.nickname };
}

export default function TransferDialog({ mons, onClose, toast }) {
  const { gameDex, byId } = useData();
  const single = mons.length === 1 ? mons[0] : null;
  const [to, setTo] = useState(null);
  const [dexUpdate, setDexUpdate] = useState(true);

  // Pour un Pokémon : statut vers chaque jeu ; pour plusieurs : bilan vers le jeu choisi
  const perGame = useMemo(
    () => (single ? OFFICIAL_GAMES.map((g) => ({ g, r: evaluateTransfer(single, g.id, { gameDex, byId }) })) : null),
    [single, gameDex, byId],
  );
  const perMon = useMemo(
    () => (to ? mons.map((m) => ({ m, r: evaluateTransfer(m, to, { gameDex, byId }) })) : []),
    [mons, to, gameDex, byId],
  );
  const doable = perMon.filter((x) => ["file", "convert", "track"].includes(x.r.status));
  const toName = GAMES.find((g) => g.id === to)?.name;

  const run = () => {
    try {
      const n = applyTransfers(
        doable.map(({ m, r }) => ({ id: m.id, to, patch: transferPatch(m, to, r.status, byId), via: r.steps.map((s) => s.label).join(" → ") || r.status })),
        { dexUpdate },
      );
      toast(`${n} Pokémon transféré(s) vers ${toName}${perMon.length > n ? ` · ${perMon.length - n} indisponible(s)` : ""}`);
      onClose();
    } catch (e) {
      toast(`Transfert impossible : ${e.message}`);
    }
  };

  const sel = single && to ? perGame.find((x) => x.g.id === to)?.r : null;

  return (
    <Modal open onClose={onClose} wide title={single ? `Transférer ${single.nickname || byId[single.species]?.fr || "ce Pokémon"}` : `Transférer ${mons.length} Pokémon`}>
      {single ? (
        <>
          <p className="mb-3 text-sm text-zinc-400">
            Actuellement dans <b className="text-zinc-200">{GAMES.find((g) => g.id === single.game)?.name ?? "jeu inconnu"}</b>. Choisis le jeu de destination : les règles des jeux officiels sont appliquées.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {perGame.map(({ g, r }) => {
              const gs = genStyle(g.gen);
              return (
                <button
                  key={g.id}
                  disabled={r.status === "same"}
                  onClick={() => setTo(g.id)}
                  className={cx(
                    "flex items-start gap-2 rounded-xl border p-2 text-left transition",
                    to === g.id ? "border-emerald-400 bg-emerald-500/10" : "border-zinc-800 bg-zinc-950 hover:border-zinc-600",
                    r.status === "same" && "opacity-40",
                  )}
                >
                  <span className={cx("mt-1 h-2 w-2 shrink-0 rounded-full", gs.bg)} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-zinc-100">{g.name}</span>
                    <span className={cx("block text-[11px]", STATUS_STYLE[r.status])}>
                      {r.status === "impossible" ? <LuBan className="mr-1 inline h-3 w-3" /> : r.status === "same" ? null : <LuCheck className="mr-1 inline h-3 w-3" />}
                      {STATUS_LABEL[r.status]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {sel && <TransferDetail r={sel} toName={toName} />}
        </>
      ) : (
        <>
          <label className="mb-3 block text-sm text-zinc-300">
            Jeu de destination
            <select className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100" value={to ?? ""} onChange={(e) => setTo(e.target.value || null)}>
              <option value="">Choisir…</option>
              {OFFICIAL_GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          {to && (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {perMon.map(({ m, r }) => (
                <div key={m.id} className="flex items-start gap-2 rounded-lg bg-zinc-950 px-2 py-1.5">
                  <Sprite id={m.species} shiny={m.shiny} size={32} />
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="text-sm text-zinc-200">{m.nickname || byId[m.species]?.fr}</div>
                    <div className={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}{r.reason ? ` — ${r.reason}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {to && (doable.length > 0 || (single && sel && sel.status !== "impossible")) && (
        <label className="mt-4 flex items-start gap-2 text-sm text-zinc-300">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-500" checked={dexUpdate} onChange={(e) => setDexUpdate(e.target.checked)} />
          <span>Mettre à jour le Dex : cocher l'espèce dans {toName} et retirer 1 du quota de transfert du jeu d'origine</span>
        </label>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Btn onClick={onClose}>Fermer</Btn>
        <Btn variant="primary" disabled={!to || !doable.length} onClick={run}>
          <LuArrowRight className="h-4 w-4" /> {doable.length > 1 ? `Transférer ${doable.length} Pokémon` : "Transférer"}
        </Btn>
      </div>
    </Modal>
  );
}

function TransferDetail({ r, toName }) {
  if (r.status === "impossible")
    return (
      <div className="mt-4 flex gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
        <LuBan className="mt-0.5 h-4 w-4 shrink-0" /> <span><b>Transfert indisponible.</b> {r.reason}</span>
      </div>
    );
  return (
    <div className="mt-4 space-y-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5 text-zinc-200">
        {r.steps.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5" title={s.detail ?? ""}>
            {i > 0 && <LuArrowRight className="h-3.5 w-3.5 text-zinc-600" />}
            <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs">{s.label}</span>
          </span>
        ))}
      </div>
      {r.status === "file" && <p className="flex gap-1.5 text-xs text-emerald-200"><LuCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Même format de données : le Pokémon est rangé dans {toName} et peut être écrit dans une sauvegarde de ce jeu.</p>}
      {r.status === "convert" && <p className="flex gap-1.5 text-xs text-emerald-200"><LuRefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />L'application convertit le Pokémon au format Gen 2, comme la Time Capsule.</p>}
      {r.status === "track" && <p className="flex gap-1.5 text-xs text-sky-200"><LuInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />Transfert possible dans les jeux avec les applications officielles ci-dessus. L'application l'enregistre dans {toName} pour ton suivi et garde ses données d'origine (elle ne convertit pas d'une génération à l'autre).</p>}
      {r.warnings.map((w, i) => <p key={i} className="flex gap-1.5 text-xs text-amber-200"><LuTriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</p>)}
    </div>
  );
}
