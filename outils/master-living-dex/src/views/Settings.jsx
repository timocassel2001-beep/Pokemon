import { useRef, useState } from "react";
import { LuDatabase, LuDownload, LuRefreshCw, LuTrash2, LuUpload } from "react-icons/lu";
import { exportSave, importSave, resetAll, resetBank, resetDex, useStore } from "../lib/store.js";
import { Btn, Card, Confirm, downloadBlob, useData } from "../components/ui.jsx";

function storageSize() {
  try {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      n += k.length + (localStorage.getItem(k)?.length ?? 0);
    }
    return (n * 2) / 1024;
  } catch {
    return null;
  }
}

export default function Settings({ toast }) {
  const { meta, reload } = useData();
  const dex = useStore((s) => s.dex);
  const vault = useStore((s) => s.vault);
  const bankCount = vault.banks.reduce((n, b) => n + b.mons.length, 0);
  const fileRef = useRef(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const kb = storageSize();

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportSave(), null, 2)], { type: "application/json" });
    downloadBlob(blob, "master_dex_save.json");
    toast("Sauvegarde exportée : master_dex_save.json");
  };

  const doImport = async (file) => {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const r = importSave(json);
      toast(`Sauvegarde restaurée : ${r.dex} espèces suivies${r.bank != null ? `, ${r.bank} Pokémon en Banque` : " (ancien format Lovable)"}`);
    } catch (e) {
      toast(`Import impossible : ${e.message}`);
    } finally {
      fileRef.current.value = "";
    }
  };

  const confirms = {
    all: { title: "Réinitialiser toutes les données", message: "Le suivi du Living Dex ET la Banque seront effacés définitivement. Pense à exporter avant !", run: resetAll, done: "Toutes les données ont été effacées" },
    dex: { title: "Réinitialiser le Living Dex", message: "Toutes les captures des jeux officiels seront effacées. La Banque est conservée.", run: resetDex, done: "Living Dex réinitialisé" },
    bank: { title: "Vider toutes les banques", message: "Toutes les banques et tous leurs Pokémon seront supprimés. Le Living Dex est conservé.", run: resetBank, done: "Banques vidées" },
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <h2 className="mb-1 font-semibold text-zinc-100">Sauvegarde locale</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Tout est enregistré uniquement dans ce navigateur. Exporte régulièrement : vider le cache du navigateur efface les données.
        </p>
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-zinc-950 p-3"><div className="text-xl font-bold tabular-nums text-zinc-50">{Object.keys(dex).length}</div><div className="text-[11px] text-zinc-500">espèces suivies</div></div>
          <div className="rounded-xl bg-zinc-950 p-3"><div className="text-xl font-bold tabular-nums text-zinc-50">{bankCount}</div><div className="text-[11px] text-zinc-500">Pokémon en Banque ({vault.banks.length})</div></div>
          <div className="rounded-xl bg-zinc-950 p-3"><div className="text-xl font-bold tabular-nums text-zinc-50">{kb != null ? `${kb.toFixed(0)} Ko` : "?"}</div><div className="text-[11px] text-zinc-500">utilisés (~5 Mo max)</div></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="primary" onClick={doExport}><LuDownload className="h-4 w-4" /> Exporter la sauvegarde (JSON)</Btn>
          <Btn onClick={() => fileRef.current.click()}><LuUpload className="h-4 w-4" /> Importer une sauvegarde (JSON)</Btn>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => doImport(e.target.files[0])} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">L'import remplace les données actuelles. Les sauvegardes de l'ancienne version Lovable sont acceptées.</p>
      </Card>

      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-zinc-100"><LuDatabase className="h-4 w-4" /> Données Pokémon</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Noms, générations et Pokédex régionaux téléchargés depuis la PokéAPI puis gardés en cache.
          {meta?.fetchedAt && <> Dernière mise à jour : {new Date(meta.fetchedAt).toLocaleString("fr-FR")}{meta.source === "rest" && " (mode dégradé : noms anglais, sans Pokédex régionaux)"}.</>}
        </p>
        <Btn
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { await reload(); toast("Données Pokémon mises à jour"); } catch (e) { toast(`Échec : ${e.message}`); } finally { setBusy(false); }
          }}
        >
          <LuRefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Retélécharger les données
        </Btn>
      </Card>

      <Card className="border-red-900/50">
        <h2 className="mb-3 font-semibold text-red-400">Zone dangereuse</h2>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => setConfirm("dex")}>Réinitialiser le Living Dex</Btn>
          <Btn onClick={() => setConfirm("bank")}>Vider toutes les banques</Btn>
          <Btn variant="danger" onClick={() => setConfirm("all")}><LuTrash2 className="h-4 w-4" /> Réinitialiser toutes les données</Btn>
        </div>
      </Card>

      {confirm && (
        <Confirm
          open
          title={confirms[confirm].title}
          message={confirms[confirm].message}
          confirmLabel="Effacer"
          onConfirm={() => { confirms[confirm].run(); toast(confirms[confirm].done); }}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
