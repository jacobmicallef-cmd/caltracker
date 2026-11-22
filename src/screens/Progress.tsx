import { useMemo, useState } from 'react';
import { addDays, dayKey, totalsForEntries } from '../lib/nutrition';
import type { Entry, Settings, Totals, WeightLog } from '../lib/types';

interface Props {
  entries: Entry[];
  weights: WeightLog[];
  settings: Settings;
  targets: Totals;
  onLogWeight: (kg: number) => void;
}

/** A compact SVG line chart. Returns null when there is nothing to draw. */
function WeightChart({ data }: { data: WeightLog[] }) {
  const W = 320;
  const H = 120;
  const PAD = 8;

  if (data.length < 2) return null;

  const values = data.map((d) => d.kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (d.kg - min) / span) * (H - PAD * 2);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Weight over time">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--color-fat)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => {
        const [x, y] = p.split(',');
        return <circle key={i} cx={x} cy={y} r="3" fill="var(--color-fat)" />;
      })}
    </svg>
  );
}

function CalorieBars({ entries, target }: { entries: Entry[]; target: number }) {
  const AREA = 112; // px of drawable height, so bar heights resolve reliably

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(today, i - 13);
      const key = dayKey(d);
      const kcal = totalsForEntries(entries.filter((e) => e.date === key)).kcal;
      return { key, kcal, label: d.getDate() };
    });
  }, [entries]);

  const max = Math.max(target, ...days.map((d) => d.kcal)) || 1;
  const targetY = AREA - (target / max) * AREA;

  return (
    <div className="mt-4">
      <div className="relative flex gap-1.5" style={{ height: AREA }}>
        {/* the target line, so you can see at a glance which days were over */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-black/25 dark:border-white/30"
          style={{ top: targetY }}
          aria-hidden
        />
        {days.map((d) => (
          <div key={d.key} className="flex flex-1 items-end">
            <div
              className={`w-full rounded-t-md ${d.kcal > target ? 'bg-[var(--color-protein)]' : 'bg-[var(--color-ink)]'}`}
              style={{ height: d.kcal > 0 ? Math.max((d.kcal / max) * AREA, 3) : 0 }}
              title={`${d.kcal} cal`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {days.map((d) => (
          <span key={d.key} className="flex-1 text-center text-[9px] text-[var(--color-muted)]">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Progress({ entries, weights, settings, targets, onLogWeight }: Props) {
  const [input, setInput] = useState('');

  const current = weights.at(-1)?.kg ?? settings.weightKg;
  const start = weights[0]?.kg ?? settings.weightKg;
  const goal = settings.goalWeightKg;

  // progress along start -> goal, clamped so the bar never overflows
  const total = Math.abs(goal - start) || 1;
  const done = Math.abs(current - start);
  const pct = Math.min(100, Math.round((done / total) * 100));

  const changes = [3, 7, 14, 30, 90].map((n) => {
    const cutoff = dayKey(addDays(new Date(), -n));
    const before = weights.filter((w) => w.date <= cutoff).at(-1);
    const delta = before ? current - before.kg : null;
    return { n, delta };
  });

  const loggedDays = new Set(entries.map((e) => e.date)).size;
  const avg =
    loggedDays > 0 ? Math.round(totalsForEntries(entries).kcal / loggedDays) : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const kg = Number(input);
    if (kg > 0 && kg < 400) {
      onLogWeight(kg);
      setInput('');
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <h1 className="pt-2 text-[28px] font-extrabold tracking-tight">Progress</h1>

      <section className="card p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--color-muted)]">Current weight</p>
            <p className="text-[34px] font-extrabold leading-tight tabular-nums">{current.toFixed(1)} kg</p>
          </div>
          <form onSubmit={submit} className="flex gap-2">
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="kg"
              aria-label="Today's weight in kilograms"
              className="w-20 rounded-xl bg-black/[0.04] px-3 py-2.5 text-center outline-none focus:ring-2 focus:ring-[var(--color-ink)] dark:bg-white/10"
            />
            <button
              type="submit"
              className="rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-sm font-bold text-[#f3f3f5] dark:bg-white dark:text-[#121214]"
            >
              Log
            </button>
          </form>
        </div>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10">
          <div className="h-full rounded-full bg-[var(--color-ink)] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs">
          <span className="text-[var(--color-muted)]">Start {start.toFixed(1)} kg</span>
          <span className="text-[var(--color-muted)]">Goal {goal.toFixed(1)} kg</span>
        </div>

        <WeightChart data={weights} />
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-extrabold">Weight changes</h2>
        {weights.length < 2 ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Log your weight a few times and the trend will show up here.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-black/5 dark:divide-white/10">
            {changes.map((c) => (
              <li key={c.n} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-[var(--color-muted)]">{c.n} day</span>
                <span className="font-bold tabular-nums">
                  {c.delta === null ? '—' : `${c.delta > 0 ? '+' : ''}${c.delta.toFixed(1)} kg`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-extrabold">Last 14 days</h2>
          <span className="text-sm text-[var(--color-muted)]">
            avg {avg} / target {targets.kcal}
          </span>
        </div>
        <CalorieBars entries={entries} target={targets.kcal} />
      </section>
    </div>
  );
}
