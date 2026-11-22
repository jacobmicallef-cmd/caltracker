import type { Activity, Entry, Settings, Totals } from './types';

export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  athlete: 1.9,
};

export const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: 'Sedentary — desk job, little exercise',
  light: 'Light — exercise 1-3 days a week',
  moderate: 'Moderate — exercise 3-5 days a week',
  high: 'High — exercise 6-7 days a week',
  athlete: 'Athlete — hard training, or a physical job',
};

/** Roughly how many kcal sit in a kg of body mass. */
const KCAL_PER_KG = 7700;

/** Mifflin-St Jeor, the standard clinical estimate. */
export function bmr(s: Pick<Settings, 'sex' | 'weightKg' | 'heightCm' | 'age'>): number {
  const base = 10 * s.weightKg + 6.25 * s.heightCm - 5 * s.age;
  return s.sex === 'male' ? base + 5 : base - 161;
}

export function tdee(s: Settings): number {
  return bmr(s) * ACTIVITY_FACTORS[s.activity];
}

/**
 * Daily calorie + macro targets.
 * Protein is set per kg of bodyweight, fat as a share of calories,
 * and carbohydrate takes whatever calories are left.
 */
export function targetsFor(s: Settings): Totals {
  if (s.customTargets) return s.customTargets;

  const maintenance = tdee(s);
  const dailyDelta = (s.rateKgPerWeek * KCAL_PER_KG) / 7;

  let kcal = maintenance;
  if (s.goalDir === 'lose') kcal = maintenance - dailyDelta;
  if (s.goalDir === 'gain') kcal = maintenance + dailyDelta;

  // Never recommend an unreasonably low intake.
  const floor = s.sex === 'male' ? 1500 : 1200;
  kcal = Math.max(kcal, floor);

  // Protein: 2.0 g/kg when cutting (protects lean mass) or gaining (builds it), 1.6 to maintain.
  const proteinPerKg = s.goalDir === 'maintain' ? 1.6 : 2.0;
  const protein = Math.round(s.weightKg * proteinPerKg);

  // Fat: 27% of calories, with a sensible minimum for hormone health.
  const fat = Math.max(Math.round((kcal * 0.27) / 9), Math.round(s.weightKg * 0.7));

  const remaining = kcal - protein * 4 - fat * 9;
  const carbs = Math.max(Math.round(remaining / 4), 0);

  return { kcal: Math.round(kcal), protein, carbs, fat };
}

export const EMPTY_TOTALS: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function sumTotals(list: Totals[]): Totals {
  return list.reduce(
    (a, t) => ({
      kcal: a.kcal + (t.kcal || 0),
      protein: a.protein + (t.protein || 0),
      carbs: a.carbs + (t.carbs || 0),
      fat: a.fat + (t.fat || 0),
    }),
    { ...EMPTY_TOTALS },
  );
}

export function totalsForEntries(entries: Entry[]): Totals {
  const t = sumTotals(entries.map((e) => e.totals));
  return {
    kcal: Math.round(t.kcal),
    protein: Math.round(t.protein),
    carbs: Math.round(t.carbs),
    fat: Math.round(t.fat),
  };
}

/* ---------- dates ---------- */

/** Local calendar day as YYYY-MM-DD. Deliberately not toISOString, which is UTC. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Consecutive days up to and including today that have at least one entry. */
export function streakFrom(logged: Set<string>, today: Date = new Date()): number {
  let n = 0;
  let cursor = today;
  // today not being logged yet shouldn't break a streak, so start from yesterday in that case
  if (!logged.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  while (logged.has(dayKey(cursor))) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}
