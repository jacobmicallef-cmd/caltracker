import { useEffect, useState } from 'react';
import type { Entry } from '../lib/types';
import { Trash } from './icons';

export function FoodCard({ entry, onDelete }: { entry: Entry; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!entry.photo) return;
    const url = URL.createObjectURL(entry.photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [entry.photo]);

  const time = new Date(entry.loggedAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-3 text-left">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-black/5 text-xl dark:bg-white/10">
            {entry.source === 'text' ? '✎' : '\u{1F37D}'}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-bold">{entry.name}</p>
            <span className="shrink-0 text-xs text-[var(--color-muted)]">{time}</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold">{Math.round(entry.totals.kcal)} cal</p>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            {Math.round(entry.totals.protein)}p · {Math.round(entry.totals.carbs)}c · {Math.round(entry.totals.fat)}f
          </p>
        </div>
      </button>

      {open && (
        <div className="border-t border-black/5 px-3 pb-3 pt-2 dark:border-white/10">
          <ul className="space-y-1.5">
            {entry.items.map((it, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{it.name}</span>
                  <span className="text-[var(--color-muted)]"> · {it.quantity}</span>
                  {it.confidence === 'low' && (
                    <span className="ml-1.5 rounded px-1 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-carbs)] ring-1 ring-current">
                      rough
                    </span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums">{it.calories}</span>
              </li>
            ))}
          </ul>
          {entry.note && <p className="mt-2 text-xs italic text-[var(--color-muted)]">{entry.note}</p>}
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-protein)]"
          >
            <Trash className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
