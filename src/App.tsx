import { useCallback, useEffect, useState } from 'react';
import { Chart, Gear, Home as HomeIcon, Plus } from './components/icons';
import {
  addEntry,
  allEntries,
  allWeights,
  deleteEntry,
  getSettings,
  logWeight,
  saveSettings,
} from './lib/db';
import { dayKey, streakFrom, targetsFor } from './lib/nutrition';
import { DEFAULT_SETTINGS, type Entry, type Settings, type WeightLog } from './lib/types';
import { Home } from './screens/Home';
import { LogFood } from './screens/LogFood';
import { Progress } from './screens/Progress';
import { SettingsScreen } from './screens/Settings';

type Tab = 'home' | 'progress' | 'settings';

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [logging, setLogging] = useState(false);
  const [selected, setSelected] = useState(dayKey());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [weights, setWeights] = useState<WeightLog[]>([]);

  const reload = useCallback(async () => {
    const [e, w] = await Promise.all([allEntries(), allWeights()]);
    setEntries(e);
    setWeights(w);
  }, []);

  useEffect(() => {
    void (async () => {
      setSettings(await getSettings());
      await reload();
      setReady(true);
    })();
  }, [reload]);

  // If the app is left open past midnight, move it on to the new day.
  useEffect(() => {
    const id = setInterval(() => {
      const today = dayKey();
      setSelected((s) => (s === today ? s : s));
      if (document.visibilityState === 'visible' && selected < today) setSelected(today);
    }, 60_000);
    return () => clearInterval(id);
  }, [selected]);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    void saveSettings(s);
  }, []);

  const handleSave = useCallback(
    async (e: Entry) => {
      await addEntry(e);
      await reload();
      setLogging(false);
    },
    [reload],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteEntry(id);
      await reload();
    },
    [reload],
  );

  const handleWeight = useCallback(
    async (kg: number) => {
      const w = { date: dayKey(), kg };
      await logWeight(w);
      await reload();
      // keep the profile weight in step, so targets stay accurate
      updateSettings({ ...settings, weightKg: kg });
    },
    [reload, settings, updateSettings],
  );

  if (!ready) {
    return (
      <div className="grid h-full place-items-center">
        <div className="h-8 w-8 animate-spin-slow rounded-full border-4 border-black/10 border-t-[var(--color-ink)]" />
      </div>
    );
  }

  const dayEntries = entries.filter((e) => e.date === selected).sort((a, b) => b.loggedAt - a.loggedAt);
  const logged = new Set(entries.map((e) => e.date));
  const targets = targetsFor(settings);

  const tabs: { id: Tab; label: string; Icon: typeof HomeIcon }[] = [
    { id: 'home', label: 'Home', Icon: HomeIcon },
    { id: 'progress', label: 'Progress', Icon: Chart },
    { id: 'settings', label: 'Settings', Icon: Gear },
  ];

  return (
    <div className="mx-auto min-h-full w-full max-w-lg px-5 pb-28">
      {tab === 'home' && (
        <Home
          selected={selected}
          onSelectDate={setSelected}
          logged={logged}
          streak={streakFrom(logged)}
          entries={dayEntries}
          targets={targets}
          onDelete={(id) => void handleDelete(id)}
          onOpenLog={() => setLogging(true)}
          hasKey={Boolean(settings.apiKey)}
          onOpenSettings={() => setTab('settings')}
        />
      )}

      {tab === 'progress' && (
        <Progress
          entries={entries}
          weights={weights}
          settings={settings}
          targets={targets}
          onLogWeight={(kg) => void handleWeight(kg)}
        />
      )}

      {tab === 'settings' && (
        <SettingsScreen
          settings={settings}
          onChange={updateSettings}
          onClose={() => setTab('home')}
          onReload={() => void reload()}
        />
      )}

      {/* bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg items-center gap-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="card flex flex-1 items-center justify-around rounded-full p-1.5">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={[
                'flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-semibold transition',
                tab === id ? 'bg-black/[0.05] dark:bg-white/10' : 'text-[var(--color-muted)]',
              ].join(' ')}
            >
              <Icon className="h-[22px] w-[22px]" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLogging(true)}
          aria-label="Log food"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--color-ink)] text-[#f3f3f5] shadow-lg active:scale-95 dark:bg-white dark:text-[#121214]"
        >
          <Plus className="h-7 w-7" />
        </button>
      </nav>

      {logging && (
        <LogFood
          settings={settings}
          date={selected}
          onClose={() => setLogging(false)}
          onSave={(e) => void handleSave(e)}
          onModelResolved={(model) => updateSettings({ ...settings, model })}
          onOpenSettings={() => {
            setLogging(false);
            setTab('settings');
          }}
        />
      )}
    </div>
  );
}
