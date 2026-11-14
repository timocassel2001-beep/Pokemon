import { memo, useEffect, useRef, useState } from "react";
import { LuCalendarClock, LuCheck } from "react-icons/lu";
import { ShinyStar, Sprite, cx, pad } from "./ui.jsx";

/** Affiche une longue liste par paquets (défilement infini léger). */
export function useIncremental(items, step = 180) {
  const [count, setCount] = useState(step);
  const sentinel = useRef(null);
  useEffect(() => setCount(step), [items, step]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setCount((c) => c + step), { rootMargin: "1200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [items, step, count]);
  return { visible: items.slice(0, count), more: count < items.length, sentinel };
}

export const PokemonCard = memo(function PokemonCard({
  s, number, caught, shiny, event, quota, shinyQuota, sub, onOpen, onQuick, accent, footer, quickOn,
}) {
  return (
    <div
      className={cx(
        "card-cv group relative flex flex-col items-center rounded-xl border bg-zinc-900 px-1.5 pb-2 pt-1.5 transition hover:-translate-y-0.5 hover:border-zinc-500",
        caught ? cx("border-zinc-700", accent) : "border-zinc-800/80",
      )}
    >
      <div className="flex h-5 w-full items-center justify-between gap-1 text-[10px] tabular-nums text-zinc-500">
        <span className="truncate">{number ?? `#${pad(s.id)}`}</span>
        <span className="flex items-center gap-1">
          {event && <LuCalendarClock className="h-3 w-3 text-fuchsia-400" />}
          {shiny && <ShinyStar className="h-3.5 w-3.5" />}
          {onQuick && (
            <button
              onClick={() => onQuick(s.id)}
              className={cx(
                "grid h-5 w-5 place-items-center rounded-md border transition",
                (quickOn ?? caught) ? "border-emerald-400 bg-emerald-500 text-zinc-950" : "border-zinc-700 bg-zinc-950 text-transparent hover:border-emerald-400 hover:text-emerald-400",
              )}
              title={(quickOn ?? caught) ? "Marquer non capturé (normal)" : "Marquer capturé (normal)"}
              aria-label="Capturé"
            >
              <LuCheck className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </div>
      <button onClick={() => onOpen(s.id)} className="flex w-full flex-col items-center outline-none" title={`${s.fr} (${s.en})`}>
        <Sprite id={s.id} shiny={shiny} size={72} dim={!caught} className="-my-1" />
        <div className={cx("w-full truncate text-center text-xs font-medium", caught ? "text-zinc-100" : "text-zinc-500")}>{s.fr}</div>
        {sub && <div className="text-center text-[10px] leading-tight text-zinc-500">{sub}</div>}
      </button>
      {footer}
      {(event || quota > 0 || shinyQuota > 0) && (
        <div className="mt-1 flex flex-wrap justify-center gap-1">
          {event && <span className="rounded bg-fuchsia-500/20 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-fuchsia-300">Event</span>}
          {quota > 0 && <span className="rounded bg-sky-500/20 px-1.5 py-px text-[9px] font-bold text-sky-300">+{quota} transf.</span>}
          {shinyQuota > 0 && <span className="rounded bg-amber-400/20 px-1.5 py-px text-[9px] font-bold text-amber-300">+{shinyQuota}★</span>}
        </div>
      )}
    </div>
  );
});

export function Grid({ children }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2">{children}</div>;
}
