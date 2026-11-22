import { useState } from 'react';
import { Back } from '../components/icons';
import { exportJson, importJson } from '../lib/db';
import { listModels, resolveModel, type ModelInfo } from '../lib/gemini';
import { ACTIVITY_LABELS, targetsFor, tdee } from '../lib/nutrition';
import type { Activity, GoalDir, Settings as S, Sex } from '../lib/types';

interface Props {
  settings: S;
  onChange: (s: S) => void;
  onClose: () => void;
  onReload: () => void;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--color-muted)]">{hint}</span>}
    </label>
  );
}

const inputCls =
  'mt-1.5 w-full rounded-xl bg-black/[0.04] px-3 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-[var(--color-ink)] dark:bg-white/10';

export function SettingsScreen({ settings, onChange, onClose, onReload }: Props) {
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const set = <K extends keyof S>(k: K, v: S[K]) => onChange({ ...settings, [k]: v });
  const targets = targetsFor(settings);

  async function testKey() {
    setTesting(true);
    setTestMsg(null);
    try {
      const list = await listModels(settings.apiKey);
      setModels(list);
      if (settings.model === 'auto') {
        const best = await resolveModel(settings.apiKey);
        setTestMsg(`Key works. ${list.length} models available; "${best}" will be used.`);
      } else if (list.some((m) => m.name === settings.model)) {
        setTestMsg(`Key works. ${list.length} models available, and "${settings.model}" is one of them.`);
      } else {
        setTestMsg(`Key works, but "${settings.model}" is not available. Pick one from the list below.`);
      }
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : 'Could not reach Gemini.');
    } finally {
      setTesting(false);
    }
  }

  async function doExport() {
    setBusy('export');
    try {
      const json = await exportJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cal-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('import');
    try {
      const res = await importJson(await file.text());
      setTestMsg(`Restored ${res.entries} food entries and ${res.weights} weigh-ins.`);
      onReload();
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : 'That backup could not be read.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-center gap-3 pt-2">
        <button type="button" onClick={onClose} aria-label="Back" className="card grid h-10 w-10 place-items-center rounded-full">
          <Back className="h-5 w-5" />
        </button>
        <h1 className="text-[28px] font-extrabold tracking-tight">Settings</h1>
      </header>

      {/* API key */}
      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-extrabold">Gemini API key</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Get a free key at <span className="font-semibold text-[var(--color-ink)]">aistudio.google.com</span> → Get API key.
          It is stored only on this phone and is never sent anywhere except Google.
        </p>
        <Field label="Key">
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => set('apiKey', e.target.value.trim())}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
            className={inputCls}
          />
        </Field>
        <Field
          label="Model"
          hint={
            settings.model === 'auto'
              ? 'Left on "auto", the app asks your key which models it can use and picks the best one for photos.'
              : 'Set this back to "auto" to let the app choose again if this model stops working.'
          }
        >
          <input value={settings.model} onChange={(e) => set('model', e.target.value.trim())} className={inputCls} />
        </Field>
        <button
          type="button"
          onClick={() => void testKey()}
          disabled={!settings.apiKey || testing}
          className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-bold text-[#f3f3f5] disabled:opacity-30 dark:bg-white dark:text-[#121214]"
        >
          {testing ? 'Checking…' : 'Test key'}
        </button>
        {testMsg && <p className="text-sm font-medium">{testMsg}</p>}
        {models && (
          <div className="flex flex-wrap gap-2">
            {[{ name: 'auto', displayName: 'auto' }, ...models].map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => set('model', m.name)}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-semibold',
                  m.name === settings.model
                    ? 'bg-[var(--color-ink)] text-[#f3f3f5] dark:bg-white dark:text-[#121214]'
                    : 'bg-black/[0.06] dark:bg-white/10',
                ].join(' ')}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* profile */}
      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-extrabold">About you</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sex">
            <select value={settings.sex} onChange={(e) => set('sex', e.target.value as Sex)} className={inputCls}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Age">
            <input type="number" inputMode="numeric" value={settings.age} onChange={(e) => set('age', Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Height (cm)">
            <input type="number" inputMode="decimal" value={settings.heightCm} onChange={(e) => set('heightCm', Number(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Weight (kg)">
            <input type="number" inputMode="decimal" step="0.1" value={settings.weightKg} onChange={(e) => set('weightKg', Number(e.target.value))} className={inputCls} />
          </Field>
        </div>
        <Field label="Activity level">
          <select value={settings.activity} onChange={(e) => set('activity', e.target.value as Activity)} className={inputCls}>
            {(Object.keys(ACTIVITY_LABELS) as Activity[]).map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_LABELS[a]}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {/* goal */}
      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-extrabold">Your goal</h2>
        <div className="grid grid-cols-3 gap-2">
          {(['lose', 'maintain', 'gain'] as GoalDir[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => set('goalDir', g)}
              className={[
                'rounded-xl py-2.5 text-sm font-bold capitalize',
                settings.goalDir === g
                  ? 'bg-[var(--color-ink)] text-[#f3f3f5] dark:bg-white dark:text-[#121214]'
                  : 'bg-black/[0.06] dark:bg-white/10',
              ].join(' ')}
            >
              {g === 'lose' ? 'Lose' : g === 'gain' ? 'Gain' : 'Maintain'}
            </button>
          ))}
        </div>
        {settings.goalDir !== 'maintain' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rate (kg per week)" hint="0.25–0.5 kg is a sustainable pace.">
              <input
                type="number"
                inputMode="decimal"
                step="0.05"
                min="0"
                max="1"
                value={settings.rateKgPerWeek}
                onChange={(e) => set('rateKgPerWeek', Math.max(0, Number(e.target.value)))}
                className={inputCls}
              />
            </Field>
            <Field label="Goal weight (kg)">
              <input type="number" inputMode="decimal" step="0.1" value={settings.goalWeightKg} onChange={(e) => set('goalWeightKg', Number(e.target.value))} className={inputCls} />
            </Field>
          </div>
        )}

        <div className="rounded-2xl bg-black/[0.04] p-4 dark:bg-white/[0.07]">
          <p className="text-sm font-bold">Your daily targets</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Maintenance is about {Math.round(tdee(settings))} cal a day, from the Mifflin-St Jeor equation.
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ['Calories', targets.kcal],
              ['Protein', `${targets.protein}g`],
              ['Carbs', `${targets.carbs}g`],
              ['Fat', `${targets.fat}g`],
            ].map(([l, v]) => (
              <div key={String(l)}>
                <p className="text-lg font-extrabold tabular-nums">{v}</p>
                <p className="text-[11px] text-[var(--color-muted)]">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          These are estimates from a standard formula, not medical advice. If you are under 18, training hard, or have any
          health condition, it is worth running your targets past a doctor or dietitian.
        </p>
      </section>

      {/* backup */}
      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-extrabold">Backup</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Your log lives on this phone only. Export a file now and then and keep it in Drive — clearing your browser data
          would otherwise wipe it. Photos are not included; everything else is.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => void doExport()} disabled={busy !== null} className="flex-1 rounded-full bg-black/[0.06] py-3 text-sm font-bold disabled:opacity-40 dark:bg-white/10">
            {busy === 'export' ? 'Exporting…' : 'Export backup'}
          </button>
          <label className="flex-1 cursor-pointer rounded-full bg-black/[0.06] py-3 text-center text-sm font-bold dark:bg-white/10">
            {busy === 'import' ? 'Restoring…' : 'Restore'}
            <input type="file" accept="application/json,.json" onChange={(e) => void doImport(e)} className="hidden" />
          </label>
        </div>
      </section>
    </div>
  );
}
