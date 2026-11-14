import { useMemo, useRef, useState } from "react";
import { LuArrowRight, LuGitCompare, LuInfo, LuPlus, LuScanSearch, LuSparkles } from "react-icons/lu";
import { analyzeSave, diffSaves } from "../lib/analyzer.js";
import { normName } from "../lib/savefile.js";
import { setPendingSave } from "../lib/pending.js";
import { getState, saveHacks } from "../lib/store.js";
import { PLATFORMS, HACK_PLATFORM_IDS, platformOf } from "../data/platforms.js";
import { Btn, Card, ShinyStar, Sprite, cx, useData } from "../components/ui.jsx";

const MODE_LABEL = { gen3: "Gen 3 d'origine", national: "Nationale (pokeemerald-expansion)", cfru: "Rouge Feu étendu (CFRU)" };

function FilePick({ label, file, onFile }) {
  const ref = useRef(null);
  return (
    <div className="flex items-center gap-3">
      <Btn variant={file ? "ghost" : "primary"} onClick={() => ref.current.click()}><LuScanSearch className="h-4 w-4" /> {label}</Btn>
      <input ref={ref} type="file" className="hidden" onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
      {file && <span className="truncate text-sm text-zinc-400">{file.name} · {(file.size / 1024).toFixed(1)} Ko</span>}
    </div>
  );
}

function MonStrip({ mons }) {
  const { byId } = useData();
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {mons.slice(0, 36).map((p, i) => (
        <div key={i} className="relative" title={`${p.nickname || byId[p.species]?.fr || "?"} · #${p.species ?? "?"}${p._offset != null ? ` · octet ${p._offset.toString(16)}` : ""}`}>
          <Sprite id={p.species} shiny={p.shiny} size={36} className="rounded-lg bg-zinc-950" />
          {p.shiny && <ShinyStar className="absolute right-0 top-0 h-3 w-3" />}
        </div>
      ))}
      {mons.length > 36 && <span className="self-center text-xs text-zinc-500">+{mons.length - 36}</span>}
    </div>
  );
}

export default function Analyzer({ toast }) {
  const { byId } = useData();
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [report, setReport] = useState(null);
  const [diff, setDiff] = useState(null);
  const [busy, setBusy] = useState(false);

  const names = useMemo(() => {
    const idToNames = {}, nameToId = {};
    for (const sp of Object.values(byId)) {
      const ns = [normName(sp.fr), normName(sp.en)];
      idToNames[sp.id] = ns;
      for (const nm of ns) if (nm && nameToId[nm] == null) nameToId[nm] = sp.id;
    }
    return { idToNames, nameToId };
  }, [byId]);

  const run = async (a = fileA, b = fileB) => {
    if (!a) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const bufA = await a.arrayBuffer();
      setReport(analyzeSave(a.name, bufA, names));
      setDiff(b ? diffSaves(bufA, await b.arrayBuffer()) : null);
    } catch (e) {
      toast(`Analyse impossible : ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const openInBank = (r) => {
    setPendingSave({ save: { ...r.save, fileName: report.fileName, bytes: r.save.bytes ?? new Uint8Array(0), extra: r.save.extra ?? new Uint8Array(0) }, label: r.label });
    window.location.hash = "banque";
  };

  const createHack = () => {
    const best = report.results.find((r) => r.count > 0);
    const platform = best?.save.platform;
    if (!platform || !HACK_PLATFORM_IDS.includes(platform)) return toast("Ce n'est pas une sauvegarde de hack GB/GBC/GBA/DS.");
    const name = report.fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    const hacks = getState().vault.hacks;
    const h = {
      id: Math.random().toString(36).slice(2, 10), name, platform, base: PLATFORMS[platform].base,
      dexMax: report.dexGuess, ...(report.shiny?.significant ? { shinyThreshold: report.shiny.threshold } : {}),
    };
    saveHacks([...hacks, h]);
    toast(`Hack « ${name} » ajouté (Dex ${report.dexGuess}${h.shinyThreshold ? `, shiny 1/${report.shiny.odds}` : ""})`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Card>
        <p className="mb-4 text-sm text-zinc-400">
          Pour un nouveau ROM hack ou un hack que la Banque lit mal : l'analyseur essaie toutes les méthodes de lecture
          (structure du jeu de base, balayage de tous les octets pour chaque génération), choisit la numérotation des
          espèces grâce aux surnoms, estime la règle shiny et te propose d'ouvrir le résultat dans la Banque pour transférer tes Pokémon.
        </p>
        <div className="space-y-3">
          <FilePick label="Choisir la sauvegarde à analyser" file={fileA} onFile={(f) => { setFileA(f); run(f, fileB); }} />
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200"><LuGitCompare className="h-4 w-4" /> Comparer avec une autre sauvegarde (facultatif)</div>
            <p className="mb-2 text-xs text-zinc-500">
              Si aucun Pokémon n'est trouvé : sauvegarde en jeu, dépose 1 ou 2 Pokémon dans le PC, sauvegarde à nouveau, puis compare
              les deux fichiers. L'analyseur montre les zones qui ont changé et les Pokémon apparus ou disparus.
            </p>
            <FilePick label="Choisir la 2e sauvegarde" file={fileB} onFile={(f) => { setFileB(f); run(fileA, f); }} />
          </div>
        </div>
        {busy && <p className="mt-3 text-sm text-zinc-400">Analyse en cours…</p>}
      </Card>

      {report && (
        <>
          <Card>
            <h2 className="mb-2 font-semibold text-zinc-100">Diagnostic</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="text-zinc-500">Fichier :</span> <span className="text-zinc-200">{report.fileName}</span></div>
              <div><span className="text-zinc-500">Type probable :</span> <span className="text-zinc-200">{report.sizeLabel}</span></div>
              {report.maxSpecies > 0 && <div><span className="text-zinc-500">Pokédex probable :</span> <span className="text-zinc-200">{report.dexGuess} espèces (plus grand n° vu : {report.maxSpecies})</span></div>}
              {report.nameCheck?.tested > 0 && <div><span className="text-zinc-500">Surnoms cohérents :</span> <span className="text-zinc-200">{report.nameCheck.ok} / {report.nameCheck.tested}</span></div>}
            </div>
            {report.numbering && (
              <div className="mt-3 rounded-xl bg-zinc-950 p-3 text-sm">
                <div className="mb-1 text-xs font-medium text-zinc-400">Numérotation des espèces (Gen 3) : surnoms par défaut reconnus</div>
                {report.numbering.map((m) => (
                  <div key={m.mode} className={cx("flex justify-between", report.recommendedNumbering === m.mode ? "text-emerald-300" : "text-zinc-400")}>
                    <span>{MODE_LABEL[m.mode]}{report.recommendedNumbering === m.mode ? " ← recommandée" : ""}</span><span className="tabular-nums">{m.ok} / {m.tested}</span>
                  </div>
                ))}
              </div>
            )}
            {report.shiny && (
              <div className="mt-3 flex gap-2 rounded-xl bg-zinc-950 p-3 text-sm text-zinc-300">
                <LuSparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  {report.shiny.significant ? (
                    <>Règle shiny <b>élargie</b> détectée : les {report.shiny.n} Pokémon ont tous une valeur shiny &lt; {report.shiny.threshold} (max {report.shiny.max}). Si tes Pokémon de ce hack sont tous shiny, le hack utilise une chance de <b>1/{report.shiny.odds}</b>.</>
                  ) : (
                    <>Règle shiny standard : {report.shiny.standardShiny} Pokémon shiny sur {report.shiny.n} selon la règle d'origine.</>
                  )}
                </div>
              </div>
            )}
            {report.notes.map((n, i) => <p key={i} className="mt-2 flex gap-2 text-xs text-amber-200/90"><LuInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />{n}</p>)}
            {report.results.some((r) => r.count > 0 && HACK_PLATFORM_IDS.includes(r.save.platform)) && (
              <Btn className="mt-3" onClick={createHack}><LuPlus className="h-4 w-4" /> Créer ce hack dans « Mes hacks » avec ces réglages</Btn>
            )}
          </Card>

          <div className="space-y-3">
            {report.results.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-zinc-100">{r.label}</div>
                    <div className="text-xs text-zinc-500">
                      {r.count} Pokémon · {platformOf(r.save.platform).label} · {r.method === "structure" ? (r.save.writable ? "lecture + écriture" : "lecture seule") : "balayage, lecture seule"}
                      {r.save.speciesMode ? ` · numérotation ${MODE_LABEL[r.save.speciesMode] ?? r.save.speciesMode}` : ""}
                    </div>
                  </div>
                  <Btn variant="primary" disabled={!r.count} onClick={() => openInBank(r)}>Ouvrir dans la Banque <LuArrowRight className="h-4 w-4" /></Btn>
                </div>
                {r.count > 0 && <MonStrip mons={[...r.save.boxes.flatMap((b) => b.slots), ...r.save.party].filter(Boolean)} />}
              </Card>
            ))}
          </div>
        </>
      )}

      {diff && (
        <Card>
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-zinc-100"><LuGitCompare className="h-4 w-4" /> Comparaison des deux sauvegardes</h2>
          {diff.gen3 && <p className="mb-2 text-xs text-zinc-500">Sauvegardes GBA : comparaison section par section (compteurs {diff.gen3.counterA} → {diff.gen3.counterB}).</p>}
          {diff.sizeA !== diff.sizeB && <p className="mb-2 text-xs text-amber-200">Tailles différentes ({diff.sizeA} / {diff.sizeB} octets) : ce ne sont peut-être pas deux sauvegardes du même jeu.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-400">Zones modifiées ({diff.regions.length})</div>
              <div className="max-h-72 overflow-y-auto rounded-xl bg-zinc-950 p-2 text-xs">
                {diff.regions.slice(0, 60).map((r, i) => (
                  <div key={i} className="flex justify-between gap-2 border-b border-zinc-800/60 py-1 last:border-0">
                    <span className="text-zinc-300">{r.label}</span>
                    <span className="text-right tabular-nums text-zinc-500">{r.changed != null ? `${r.changed} o · ${r.range}` : r.note}</span>
                  </div>
                ))}
                {!diff.regions.length && <span className="text-zinc-500">Aucune différence.</span>}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-400">Pokémon apparus ({diff.added.length}) / disparus ({diff.removed.length})</div>
              {diff.added.length > 0 && <MonStrip mons={diff.added} />}
              {diff.removed.length > 0 && <div className="opacity-60"><MonStrip mons={diff.removed} /></div>}
              {!diff.added.length && !diff.removed.length && <p className="text-xs text-zinc-500">Aucun Pokémon chiffré standard n'a changé : le hack utilise probablement un format propre (compact). Les zones modifiées indiquent où il stocke les Pokémon ; envoie-les moi pour ajouter le format.</p>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
