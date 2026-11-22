import { useEffect, useRef } from 'react';
import { addDays, dayKey } from '../lib/nutrition';

interface Props {
  selected: string;
  logged: Set<string>;
  onSelect: (key: string) => void;
  /** how many days back the strip reaches */
  days?: number;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function DateStrip({ selected, logged, onSelect, days = 60 }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const today = new Date();
  const todayKey = dayKey(today);

  // oldest first, with tomorrow on the end so the strip doesn't feel cut off
  const dates = Array.from({ length: days + 1 }, (_, i) => addDays(today, i - days + 1));

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selected]);

  return (
    <div ref={scroller} className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 py-1">
      {dates.map((d) => {
        const key = dayKey(d);
        const isSelected = key === selected;
        const isFuture = key > todayKey;
        const hasLog = logged.has(key);

        return (
          <button
            key={key}
            ref={isSelected ? activeRef : undefined}
            type="button"
            disabled={isFuture}
            onClick={() => onSelect(key)}
            aria-current={isSelected ? 'date' : undefined}
            aria-label={d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            className={[
              'flex w-14 shrink-0 flex-col items-center gap-1.5 rounded-2xl py-2 transition',
              isSelected ? 'bg-[var(--color-card)] shadow-sm' : '',
              isFuture ? 'opacity-35' : '',
            ].join(' ')}
          >
            <span className={`text-[13px] font-semibold ${isSelected ? '' : 'text-[var(--color-muted)]'}`}>
              {DOW[d.getDay()]}
            </span>
            <span
              className={[
                'grid h-9 w-9 place-items-center rounded-full text-[15px] font-bold',
                hasLog && !isSelected ? 'border-2 border-[var(--color-protein)]' : '',
                !hasLog && !isSelected ? 'border-2 border-black/10 dark:border-white/15' : '',
                isSelected ? 'border-2 border-transparent' : '',
              ].join(' ')}
            >
              {d.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
