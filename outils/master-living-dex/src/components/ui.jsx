import { createContext, useContext, useEffect, useState } from "react";
import { LuX, LuStar } from "react-icons/lu";
import { spriteUrl } from "../data/pokedata.js";

export const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

export const cx = (...c) => c.filter(Boolean).join(" ");
export const pad = (n) => String(n).padStart(4, "0");

export function Sprite({ id, shiny, size = 64, className = "", dim = false }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [id, shiny]);
  if (!id || err)
    return (
      <div style={{ width: size, height: size }} className={cx("grid place-items-center text-zinc-600 text-xs", className)}>
        ?
      </div>
    );
  return (
    <img
      src={spriteUrl(id, shiny)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setErr(true)}
      className={cx("pixelated select-none transition", dim && "opacity-30 grayscale", className)}
      draggable={false}
    />
  );
}

export function ShinyStar({ className = "" }) {
  return <LuStar className={cx("fill-amber-300 text-amber-300 drop-shadow", className)} />;
}

export function Bar({ value, max, color = "bg-emerald-500", className = "", thin = false }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cx("w-full overflow-hidden rounded-full bg-zinc-800", thin ? "h-1.5" : "h-2.5", className)}>
      <div className={cx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, max, size = 132, stroke = 11, color = "#34d399", label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max ? value / max : 0;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#27272a" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          opacity={pct > 0 ? 1 : 0}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-2xl font-bold tabular-nums text-zinc-50">{label ?? `${(pct * 100).toFixed(1)}%`}</div>
          {sub && <div className="text-[11px] text-zinc-400 tabular-nums">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, children, title, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={cx(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:rounded-2xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/95 px-5 py-3 backdrop-blur">
          <div className="min-w-0 font-semibold text-zinc-100">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" aria-label="Fermer">
            <LuX className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ open, title, message, confirmLabel = "Confirmer", danger = true, onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-zinc-300">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Btn onClick={onClose}>Annuler</Btn>
        <Btn
          variant={danger ? "danger" : "primary"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  );
}

export function Btn({ variant = "ghost", className = "", children, ...p }) {
  const v = {
    ghost: "border border-zinc-700 bg-zinc-800/60 text-zinc-200 hover:bg-zinc-700",
    primary: "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-semibold",
    danger: "bg-red-600 text-white hover:bg-red-500 font-semibold",
    subtle: "text-zinc-300 hover:bg-zinc-800",
  }[variant];
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
        v,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({ active, onClick, children, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition",
        active ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

export function Card({ className = "", children }) {
  return <div className={cx("rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5", className)}>{children}</div>;
}

export function Toast({ msg, onDone }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [msg, onDone]);
  if (!msg) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 shadow-xl">
      {msg}
    </div>
  );
}

/** Filtre texte : nom FR, nom EN ou numéro. */
export function matchSearch(s, q) {
  if (!q) return true;
  const n = q.trim().toLowerCase();
  if (!n) return true;
  if (/^#?\d+$/.test(n)) return String(s.id) === n.replace("#", "") || pad(s.id).includes(n.replace("#", ""));
  const norm = (x) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const nn = norm(n);
  return norm(s.fr).includes(nn) || norm(s.en).includes(nn);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
