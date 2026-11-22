import { openDB, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, type Entry, type SavedFood, type Settings, type WeightLog } from './types';

const DB_NAME = 'calai';
const DB_VERSION = 1;

let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('entries')) {
          const s = d.createObjectStore('entries', { keyPath: 'id' });
          s.createIndex('date', 'date');
        }
        if (!d.objectStoreNames.contains('weights')) {
          d.createObjectStore('weights', { keyPath: 'date' });
        }
        if (!d.objectStoreNames.contains('saved')) {
          d.createObjectStore('saved', { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains('kv')) {
          d.createObjectStore('kv');
        }
      },
    });
  }
  return dbp;
}

/* ---------- settings ---------- */

export async function getSettings(): Promise<Settings> {
  const stored = (await (await db()).get('kv', 'settings')) as Partial<Settings> | undefined;
  // merge so new fields added in later versions get sane defaults
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await (await db()).put('kv', s, 'settings');
}

/* ---------- entries ---------- */

export async function addEntry(e: Entry): Promise<void> {
  await (await db()).put('entries', e);
}

export async function deleteEntry(id: string): Promise<void> {
  await (await db()).delete('entries', id);
}

export async function entriesForDate(date: string): Promise<Entry[]> {
  const all = (await (await db()).getAllFromIndex('entries', 'date', date)) as Entry[];
  return all.sort((a, b) => b.loggedAt - a.loggedAt);
}

export async function allEntries(): Promise<Entry[]> {
  return (await (await db()).getAll('entries')) as Entry[];
}

/** Set of YYYY-MM-DD that have at least one entry — used to mark the date strip. */
export async function loggedDates(): Promise<Set<string>> {
  const all = await allEntries();
  return new Set(all.map((e) => e.date));
}

/* ---------- weights ---------- */

export async function logWeight(w: WeightLog): Promise<void> {
  await (await db()).put('weights', w);
}

export async function allWeights(): Promise<WeightLog[]> {
  const all = (await (await db()).getAll('weights')) as WeightLog[];
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export async function deleteWeight(date: string): Promise<void> {
  await (await db()).delete('weights', date);
}

/* ---------- saved foods ---------- */

export async function saveFood(f: SavedFood): Promise<void> {
  await (await db()).put('saved', f);
}

export async function allSavedFoods(): Promise<SavedFood[]> {
  const all = (await (await db()).getAll('saved')) as SavedFood[];
  return all.sort((a, b) => b.usedCount - a.usedCount);
}

export async function deleteSavedFood(id: string): Promise<void> {
  await (await db()).delete('saved', id);
}

/* ---------- backup ---------- */

/** Everything except photos, as JSON — small enough to stash in Drive. */
export async function exportJson(): Promise<string> {
  const [entries, weights, saved, settings] = await Promise.all([
    allEntries(),
    allWeights(),
    allSavedFoods(),
    getSettings(),
  ]);
  const stripped = entries.map(({ photo: _photo, ...rest }) => rest);
  // never put the API key in a backup file
  const { apiKey: _k, ...safeSettings } = settings;
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), entries: stripped, weights, saved, settings: safeSettings },
    null,
    2,
  );
}

export async function importJson(json: string): Promise<{ entries: number; weights: number }> {
  const data = JSON.parse(json);
  if (!data || typeof data !== 'object') throw new Error('That file is not a valid backup.');
  const d = await db();
  const entries: Entry[] = Array.isArray(data.entries) ? data.entries : [];
  const weights: WeightLog[] = Array.isArray(data.weights) ? data.weights : [];
  const saved: SavedFood[] = Array.isArray(data.saved) ? data.saved : [];

  const tx = d.transaction(['entries', 'weights', 'saved'], 'readwrite');
  for (const e of entries) if (e?.id) tx.objectStore('entries').put(e);
  for (const w of weights) if (w?.date) tx.objectStore('weights').put(w);
  for (const s of saved) if (s?.id) tx.objectStore('saved').put(s);
  await tx.done;

  // settings are merged, but the existing API key is always kept
  if (data.settings) {
    const current = await getSettings();
    await saveSettings({ ...current, ...data.settings, apiKey: current.apiKey });
  }
  return { entries: entries.length, weights: weights.length };
}
