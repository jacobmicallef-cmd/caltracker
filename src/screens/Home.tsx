import { DateStrip } from '../components/DateStrip';
import { FoodCard } from '../components/FoodCard';
import { Ring } from '../components/Ring';
import { Flame } from '../components/icons';
import { dayKey, totalsForEntries } from '../lib/nutrition';
import type { Entry, Totals } from '../lib/types';

interface Props {
  selected: string;
  onSelectDate: (d: string) => void;
  logged: Set<string>;
  streak: number;
  entries: Entry[];
  targets: Totals;
  onDelete: (id: string) => void;
  onOpenLog: () => void;
  hasKey: boolean;
  onOpenSettings: () => void;
}

const MACROS = [
  { key: 'protein', label: 'Protein', color: 'var(--color-protein)', emoji: '\u{1F357}' },
  { key: 'carbs', label: 'Carbs', color: 'var(--color-carbs)', emoji: '\u{1F33E}' },
  { key: 'fat', label: 'Fats', color: 'var(--color-fat)', emoji: '\u{1F951}' },
] as const;

export function Home({
  selected,
  onSelectDate,
  logged,
  streak,
  entries,
  targets,
  onDelete,
  onOpenLog,
  hasKey,
  onOpenSettings,
}: Props) {
  const eaten = totalsForEntries(entries);
  const left = {
    kcal: targets.kcal - eaten.kcal,
    protein: targets.protein - eaten.protein,
    carbs: targets.carbs - eaten.carbs,
    fat: targets.fat - eaten.fat,
  };
  const isToday = selected === dayKey();

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-[28px] font-extrabold tracking-tight">Cal Tracker</h1>
        <div className="card flex items-center gap-1.5 rounded-full px-3.5 py-1.5" title="Days logged in a row">
          <Flame className="h-5 w-5 text-[#f0772b]" />
          <span className="font-bold tabular-nums">{streak}</span>
        </div>
      </header>

      <DateStrip selected={selected} logged={logged} onSelect={onSelectDate} />

      {!hasKey && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="card w-full p-4 text-left ring-2 ring-[var(--color-carbs)]"
        >
          <p className="font-bold">Add your Gemini API key</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Photo and text logging need a free key from aistudio.google.com. Tap here to add it.
          </p>
        </button>
      )}

      {/* calories */}
      <section className="card flex items-center justify-between gap-4 p-6">
        <div className="min-w-0">
          <p className="text-[46px] font-extrabold leading-none tabular-nums">
            {Math.abs(left.kcal)}
          </p>
          <p className="mt-1.5 text-[15px] text-[var(--color-muted)]">
            Calories <span className="font-semibold text-[var(--color-ink)]">{left.kcal < 0 ? 'over' : 'left'}</span>
          </p>
        </div>
        <Ring
          progress={targets.kcal ? eaten.kcal / targets.kcal : 0}
          size={118}
          stroke={13}
          color="var(--color-ink)"
        >
          <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-black/[0.04] dark:bg-white/10">
            <Flame className="h-7 w-7" />
          </div>
        </Ring>
      </section>

      {/* macros */}
      <section className="grid grid-cols-3 gap-3">
        {MACROS.map((m) => {
          const l = left[m.key];
          const target = targets[m.key];
          return (
            <div key={m.key} className="card flex flex-col items-center gap-3 p-4">
              <div className="w-full">
                <p className="text-[19px] font-extrabold leading-none tabular-nums">{Math.abs(l)}g</p>
                <p className="mt-1 text-[13px] text-[var(--color-muted)]">
                  {m.label} <span className="font-semibold text-[var(--color-ink)]">{l < 0 ? 'over' : 'left'}</span>
                </p>
              </div>
              <Ring progress={target ? eaten[m.key] / target : 0} size={74} stroke={9} color={m.color}>
                <span className="text-lg">{m.emoji}</span>
              </Ring>
            </div>
          );
        })}
      </section>

      {/* log */}
      <section className="space-y-3 pb-2">
        <h2 className="pt-1 text-[22px] font-extrabold tracking-tight">
          {isToday ? 'Today' : new Date(selected + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>

        {entries.length === 0 ? (
          <button type="button" onClick={onOpenLog} className="card w-full p-6 text-center">
            <p className="font-bold">Nothing logged yet</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Tap the + button to snap a photo or describe what you ate.
            </p>
          </button>
        ) : (
          entries.map((e) => <FoodCard key={e.id} entry={e} onDelete={onDelete} />)
        )}
      </section>
    </div>
  );
}
