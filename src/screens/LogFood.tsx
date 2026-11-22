import { useEffect, useRef, useState } from 'react';
import { Back, Camera, Check, Gallery, Mic, Trash } from '../components/icons';
import { analyzePhoto, analyzeText, totalsOf, type AnalysisResult } from '../lib/gemini';
import { forThumbnail } from '../lib/image';
import { dictate, speechSupported, type Dictation } from '../lib/speech';
import type { Entry, FoodItem, Settings } from '../lib/types';

interface Props {
  settings: Settings;
  date: string;
  onClose: () => void;
  onSave: (e: Entry) => void;
  onOpenSettings: () => void;
  /** called when the model id was discovered automatically, so it can be remembered */
  onModelResolved: (model: string) => void;
}

type Stage = 'input' | 'working' | 'review';

export function LogFood({ settings, date, onClose, onSave, onOpenSettings, onModelResolved }: Props) {
  const [stage, setStage] = useState<Stage>('input');
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [name, setName] = useState('');
  const [listening, setListening] = useState(false);

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const dictation = useRef<Dictation | null>(null);

  useEffect(() => {
    if (!photo) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => () => dictation.current?.stop(), []);

  function reset() {
    setStage('input');
    setResult(null);
    setItems([]);
    setPhoto(null);
    setText('');
    setError(null);
  }

  async function run(fn: () => Promise<AnalysisResult>) {
    setError(null);
    setStage('working');
    try {
      const r = await fn();
      setResult(r);
      setItems(r.items);
      setName(r.mealName);
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setStage('input');
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhoto(file);
    void run(() => analyzePhoto(file, settings, text, onModelResolved));
  }

  function toggleDictation() {
    if (listening) {
      dictation.current?.stop();
      return;
    }
    setError(null);
    const d = dictate(
      (t) => setText(t),
      (err) => {
        setListening(false);
        if (err) setError(err);
      },
    );
    if (!d) {
      setError('Voice input is not available in this browser.');
      return;
    }
    dictation.current = d;
    setListening(true);
  }

  async function save() {
    const totals = totalsOf(items);
    const thumb = photo ? await forThumbnail(photo).catch(() => undefined) : undefined;
    onSave({
      id: crypto.randomUUID(),
      date,
      loggedAt: Date.now(),
      name: name.trim() || 'Meal',
      items,
      totals,
      source: photo ? 'photo' : 'text',
      photo: thumb,
      note: result?.note,
    });
  }

  function scaleItem(index: number, factor: number) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              calories: Math.round(it.calories * factor),
              protein_g: Math.round(it.protein_g * factor),
              carbs_g: Math.round(it.carbs_g * factor),
              fat_g: Math.round(it.fat_g * factor),
              quantity: `${it.quantity} ×${factor}`,
            }
          : it,
      ),
    );
  }

  const totals = totalsOf(items);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#f3f3f5] px-5 pb-8 dark:bg-[#121214]">
      <header className="sticky top-0 -mx-5 flex items-center gap-3 bg-[#f3f3f5]/90 px-5 py-3 backdrop-blur dark:bg-[#121214]/90">
        <button
          type="button"
          onClick={stage === 'review' ? reset : onClose}
          aria-label="Back"
          className="card grid h-10 w-10 place-items-center rounded-full"
        >
          <Back className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-extrabold">{stage === 'review' ? 'Check it over' : 'Log food'}</h2>
      </header>

      {error && (
        <div className="card mt-2 border-l-4 border-[var(--color-protein)] p-4">
          <p className="text-sm font-medium">{error}</p>
          {/api key|Settings/i.test(error) && (
            <button type="button" onClick={onOpenSettings} className="mt-2 text-sm font-bold underline">
              Open Settings
            </button>
          )}
        </div>
      )}

      {stage === 'working' && (
        <div className="card mt-4 flex flex-col items-center gap-4 p-10">
          <div className="h-10 w-10 animate-spin-slow rounded-full border-4 border-black/10 border-t-[var(--color-ink)] dark:border-white/15 dark:border-t-white" />
          <p className="font-semibold">Working out the macros…</p>
          <p className="-mt-2 text-sm text-[var(--color-muted)]">This usually takes a few seconds.</p>
        </div>
      )}

      {stage === 'input' && (
        <div className="mt-2 space-y-4">
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" onChange={onPickFile} className="hidden" />
          <input ref={galleryInput} type="file" accept="image/*" onChange={onPickFile} className="hidden" />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraInput.current?.click()}
              className="card flex flex-col items-center gap-2 p-6 font-bold"
            >
              <Camera className="h-8 w-8" />
              Take photo
            </button>
            <button
              type="button"
              onClick={() => galleryInput.current?.click()}
              className="card flex flex-col items-center gap-2 p-6 font-bold"
            >
              <Gallery className="h-8 w-8" />
              From gallery
            </button>
          </div>

          <div className="card p-4">
            <label htmlFor="desc" className="text-sm font-bold">
              Or describe what you ate
            </label>
            <textarea
              id="desc"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Two slices of wholemeal toast with peanut butter and a banana"
              className="mt-2 w-full resize-none rounded-xl bg-black/[0.04] p-3 text-[15px] outline-none placeholder:text-[var(--color-muted)] focus:ring-2 focus:ring-[var(--color-ink)] dark:bg-white/10"
            />
            <div className="mt-3 flex gap-2">
              {speechSupported() && (
                <button
                  type="button"
                  onClick={toggleDictation}
                  className={[
                    'flex items-center justify-center gap-2 rounded-full px-4 py-3 font-bold transition',
                    listening ? 'bg-[var(--color-protein)] text-white' : 'bg-black/[0.06] dark:bg-white/10',
                  ].join(' ')}
                >
                  <Mic className="h-5 w-5" />
                  {listening ? 'Listening…' : 'Speak'}
                </button>
              )}
              <button
                type="button"
                disabled={!text.trim()}
                onClick={() => void run(() => analyzeText(text, settings, onModelResolved))}
                className="flex-1 rounded-full bg-[var(--color-ink)] px-4 py-3 font-bold text-[#f3f3f5] disabled:opacity-30 dark:bg-white dark:text-[#121214]"
              >
                Work out macros
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              Saying the portion helps a lot — &ldquo;a large bowl&rdquo;, &ldquo;about 200 g&rdquo;, &ldquo;half a tin&rdquo;.
            </p>
          </div>
        </div>
      )}

      {stage === 'review' && result && (
        <div className="mt-2 space-y-4">
          {photoUrl && <img src={photoUrl} alt="" className="h-48 w-full rounded-3xl object-cover" />}

          <div className="card p-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Meal name"
              className="w-full bg-transparent text-xl font-extrabold outline-none"
            />
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-[34px] font-extrabold leading-none tabular-nums">{totals.kcal}</span>
              <span className="text-[var(--color-muted)]">calories</span>
            </div>
            <div className="mt-2 flex gap-4 text-sm font-semibold">
              <span style={{ color: 'var(--color-protein)' }}>{totals.protein}g protein</span>
              <span style={{ color: 'var(--color-carbs)' }}>{totals.carbs}g carbs</span>
              <span style={{ color: 'var(--color-fat)' }}>{totals.fat}g fat</span>
            </div>
            {result.note && <p className="mt-3 text-xs italic text-[var(--color-muted)]">{result.note}</p>}
          </div>

          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{it.name}</p>
                    <p className="text-sm text-[var(--color-muted)]">{it.quantity}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold tabular-nums">{it.calories} cal</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {it.protein_g}p · {it.carbs_g}c · {it.fat_g}f
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-[var(--color-muted)]">Ate</span>
                  {[0.5, 2].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => scaleItem(i, f)}
                      className="rounded-full bg-black/[0.06] px-2.5 py-1 text-xs font-bold dark:bg-white/10"
                    >
                      {f === 0.5 ? 'half' : 'double'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setItems((p) => p.filter((_, j) => j !== i))}
                    aria-label={`Remove ${it.name}`}
                    className="ml-auto text-[var(--color-muted)]"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => void save()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] py-4 text-lg font-bold text-[#f3f3f5] disabled:opacity-30 dark:bg-white dark:text-[#121214]"
          >
            <Check className="h-5 w-5" /> Add to today
          </button>
        </div>
      )}
    </div>
  );
}
