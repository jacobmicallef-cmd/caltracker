/** Minimal typing for the vendor-prefixed Web Speech API available in Chrome on Android. */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

function getCtor(): Ctor | null {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = () => getCtor() !== null;

export interface Dictation {
  stop(): void;
}

/** Start dictation. onText fires with the full transcript so far. */
export function dictate(
  onText: (text: string) => void,
  onDone: (err?: string) => void,
): Dictation | null {
  const Ctor = getCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  rec.continuous = false;

  rec.onresult = (e) => {
    let text = '';
    for (let i = 0; i < e.results.length; i += 1) text += e.results[i][0].transcript;
    onText(text.trim());
  };
  rec.onerror = (e) => {
    const messages: Record<string, string> = {
      'not-allowed': 'Microphone access was blocked. Allow it in your browser settings.',
      'no-speech': 'I did not catch anything. Try again.',
      network: 'Speech recognition needs a connection.',
    };
    onDone(messages[e.error] ?? `Dictation failed (${e.error}).`);
  };
  rec.onend = () => onDone();

  try {
    rec.start();
  } catch {
    return null;
  }
  return { stop: () => rec.stop() };
}
