import { useMemo, useState } from "react";
import { Sprite, cx, inputCls, matchSearch, pad, useData } from "./ui.jsx";

export default function SpeciesPicker({ value, onChange, max }) {
  const { species, byId } = useData();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const cur = value ? byId[value] : null;
  const results = useMemo(() => species.filter((s) => matchSearch(s, q)).slice(0, 40), [species, q]);
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {cur && <Sprite id={cur.id} size={40} className="shrink-0 rounded-lg bg-zinc-950" />}
        <input
          className={inputCls}
          placeholder={cur ? `${cur.fr} (#${pad(cur.id)}) — taper pour changer` : "Rechercher une espèce…"}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && q && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s.id); setQ(""); setOpen(false); }}
              className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm hover:bg-zinc-800"
            >
              <Sprite id={s.id} size={32} />
              <span className="text-zinc-100">{s.fr}</span>
              <span className="text-xs text-zinc-500">#{pad(s.id)} · {s.en}</span>
              {max && s.id > max && <span className={cx("ml-auto rounded bg-amber-500/15 px-1.5 text-[10px] text-amber-300")}>hack étendu</span>}
            </button>
          ))}
          {!results.length && <div className="px-3 py-2 text-sm text-zinc-500">Aucun résultat</div>}
        </div>
      )}
    </div>
  );
}
