import { useState } from "react";
import { NATURES, BALLS, STAT_LABELS } from "../lib/pkm.js";
import { Btn, Field, Modal, inputCls } from "./ui.jsx";
import { useStore } from "../lib/store.js";
import { platformOf } from "../data/platforms.js";
import { GAMES } from "../data/games.js";
import SpeciesPicker from "./SpeciesPicker.jsx";

const blank = (hack) => ({
  source: "manual",
  platform: hack?.platform ?? "gba",
  hack: hack?.id ?? "",
  species: null,
  nickname: "",
  level: 5,
  shiny: false,
  gender: "M",
  nature: null,
  abilityText: "",
  itemText: "",
  movesText: ["", "", "", ""],
  ot: "",
  tid: "",
  ball: 4,
  ivs: [null, null, null, null, null, null],
  notes: "",
});

/** Création manuelle ou modification d'un Pokémon de la Banque. */
export default function MonEditor({ mon, defaultHack, onSave, onClose, kind = "hack" }) {
  const bankHacks = useStore((s) => s.bank.hacks);
  const [f, setF] = useState(() => (mon ? { ...blank(), ...mon, movesText: mon.movesText ?? ["", "", "", ""], ivs: mon.ivs ?? blank().ivs } : blank(defaultHack)));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const fromFile = f.source !== "manual";
  const official = kind === "official";
  const hack = bankHacks.find((h) => h.id === f.hack);
  const offGame = GAMES.find((g) => g.id === f.game);
  const platform = official ? (offGame ? ({ 1: "gb", 2: "gbc", 3: "gba", 4: "nds", 5: "nds5", 6: "3ds6", 7: "3ds7", 8: "sw8", 9: "sw9" }[offGame.gen]) : f.platform) : hack?.platform ?? f.platform;
  const P = platformOf(platform);
  const max = P.max;

  const save = () => {
    if (!f.species) return;
    onSave({ ...f, platform, ivMax: P.gen <= 2 ? 15 : 31, level: f.level === "" ? null : Number(f.level), tid: f.tid === "" ? null : Number(f.tid) });
  };

  return (
    <Modal open onClose={onClose} wide title={mon ? "Modifier la fiche" : "Ajouter un Pokémon manuellement"}>
      <div className="grid gap-4 sm:grid-cols-2">
        {official ? (
          <Field label="Jeu officiel d'origine" className="sm:col-span-2">
            <select className={inputCls} value={f.game ?? ""} onChange={(e) => setF((x) => ({ ...x, game: e.target.value, hack: null }))}>
              <option value="">—</option>
              {GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
        ) : (
        <Field label="Hack d'origine" className="sm:col-span-2">
          <select className={inputCls} value={f.hack} onChange={(e) => set("hack", e.target.value)}>
            {bankHacks.map((h) => (
              <option key={h.id} value={h.id}>{h.name} — {platformOf(h.platform).label} · base {h.base}</option>
            ))}
          </select>
        </Field>
        )}
        <Field label={fromFile && f.species ? "Espèce (corriger seulement si mal détectée)" : "Espèce *"} className="sm:col-span-2">
          <SpeciesPicker value={f.species} onChange={(v) => set("species", v)} max={max} />
          {f.species > max && <p className="mt-1 text-xs text-amber-300">Espèce au-delà du Pokédex Gen {P.gen} ({max}) : normal pour un hack à Pokédex étendu.</p>}
        </Field>
        <Field label="Surnom">
          <input className={inputCls} value={f.nickname} onChange={(e) => set("nickname", e.target.value)} maxLength={12} />
        </Field>
        <Field label="Niveau">
          <input className={inputCls} type="number" min={1} max={100} value={f.level ?? ""} onChange={(e) => set("level", e.target.value)} />
        </Field>

        {!fromFile && (
          <>
            <div className="flex items-end gap-2">
              <Field label="Sexe" className="flex-1">
                <select className={inputCls} value={f.gender ?? "N"} onChange={(e) => set("gender", e.target.value)}>
                  <option value="M">♂ Mâle</option>
                  <option value="F">♀ Femelle</option>
                  <option value="N">Asexué</option>
                </select>
              </Field>
              <label className="mb-2 flex items-center gap-2 text-sm text-amber-200">
                <input type="checkbox" checked={f.shiny} onChange={(e) => set("shiny", e.target.checked)} className="h-4 w-4 accent-amber-400" /> Shiny
              </label>
            </div>
            <Field label="Nature">
              <select className={inputCls} value={f.nature ?? ""} onChange={(e) => set("nature", e.target.value === "" ? null : Number(e.target.value))}>
                <option value="">—</option>
                {NATURES.map((n, i) => <option key={n} value={i}>{n}</option>)}
              </select>
            </Field>
            <Field label="Talent"><input className={inputCls} value={f.abilityText} onChange={(e) => set("abilityText", e.target.value)} /></Field>
            <Field label="Objet tenu"><input className={inputCls} value={f.itemText} onChange={(e) => set("itemText", e.target.value)} /></Field>
            <Field label="Ball">
              <select className={inputCls} value={f.ball ?? 4} onChange={(e) => set("ball", Number(e.target.value))}>
                {Object.entries(BALLS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Dresseur (DO)"><input className={inputCls} value={f.ot} onChange={(e) => set("ot", e.target.value)} /></Field>
              <Field label="ID"><input className={inputCls} inputMode="numeric" value={f.tid ?? ""} onChange={(e) => set("tid", e.target.value.replace(/\D/g, "").slice(0, 5))} /></Field>
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-zinc-400">Attaques</span>
              <div className="grid grid-cols-2 gap-2">
                {f.movesText.map((m, i) => (
                  <input key={i} className={inputCls} placeholder={`Attaque ${i + 1}`} value={m} onChange={(e) => set("movesText", f.movesText.map((x, j) => (j === i ? e.target.value : x)))} />
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-zinc-400">IV (0–{P.gen <= 2 ? 15 : 31}, facultatif)</span>
              <div className="grid grid-cols-6 gap-2">
                {STAT_LABELS.map((l, i) => (
                  <label key={l} className="text-center">
                    <input className={inputCls + " !px-1 text-center"} inputMode="numeric" value={f.ivs[i] ?? ""} onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      set("ivs", f.ivs.map((x, j) => (j === i ? (v === "" ? null : Math.min(P.gen <= 2 ? 15 : 31, Number(v))) : x)));
                    }} />
                    <span className="text-[10px] text-zinc-500">{l}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        <Field label="Notes" className="sm:col-span-2">
          <textarea className={inputCls} rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Lieu de capture, événement, projet de transfert…" />
        </Field>
      </div>
      {fromFile && <p className="mt-3 text-xs text-zinc-500">Pokémon importé depuis un fichier : ses statistiques viennent du fichier et ne sont pas modifiables ici (le fichier exporté reste identique à l'original).</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Btn onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" disabled={!f.species} onClick={save}>Enregistrer</Btn>
      </div>
    </Modal>
  );
}
