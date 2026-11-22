import { blobToBase64, forAnalysis } from './image';
import type { FoodItem, Settings, Totals } from './types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface AnalysisResult {
  mealName: string;
  items: FoodItem[];
  totals: Totals;
  /** the model's own caveat, shown under the result */
  note?: string;
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    meal_name: {
      type: 'STRING',
      description: 'A short name for the meal as a whole, e.g. "Chicken salad with rice".',
    },
    items: {
      type: 'ARRAY',
      description: 'One entry per distinct food or drink.',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          quantity: {
            type: 'STRING',
            description: 'The portion you assumed, with units, e.g. "150 g" or "1 medium apple".',
          },
          calories: { type: 'NUMBER' },
          protein_g: { type: 'NUMBER' },
          carbs_g: { type: 'NUMBER' },
          fat_g: { type: 'NUMBER' },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
        },
        required: ['name', 'quantity', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'confidence'],
      },
    },
    note: {
      type: 'STRING',
      description:
        'One short sentence naming the biggest assumption you made, or an empty string if there is nothing worth flagging.',
    },
  },
  required: ['meal_name', 'items', 'note'],
} as const;

const SYSTEM_PROMPT = `You are a nutrition estimator for a personal calorie-tracking app. You return macronutrient estimates for food.

How to estimate portions:
- Use visual reference points for scale: the size of the plate or bowl, cutlery, a hand, a can or bottle, the grain of the table surface. A standard dinner plate is about 27 cm across; a side plate about 20 cm.
- Account for what you cannot see. Food is often piled or layered, and sauces, oils and butter used in cooking add calories that are invisible in a photo. Fried food absorbs oil. Restaurant and takeaway portions run larger and are cooked with more fat than home portions.
- If a packaged product is identifiable from its label or packaging, use that product's published nutrition data for the visible serving.
- Give one item per distinct food. Do not merge a whole plate into a single line unless it is genuinely one dish.

How to report:
- calories, protein_g, carbs_g and fat_g are for the portion you state in "quantity", not per 100 g.
- Keep the macros roughly consistent with the calories: protein and carbohydrate are about 4 kcal per gram, fat about 9.
- Set confidence to "high" for a clearly visible, easily identified portion; "medium" when the food is clear but the amount is uncertain; "low" when the food itself is ambiguous or largely hidden.
- Prefer a reasonable central estimate over a deliberately cautious one. The user is tracking trends over weeks, so a consistent estimate is more useful than a hedged one.
- If the input is not food at all, return an empty items array and say so in "note".`;

function endpoint(model: string, apiKey: string) {
  return `${BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

/**
 * Score a model id so we can pick a sensible default without hardcoding one.
 * Google renames and retires these regularly, so the app asks the key what it
 * can actually use rather than assuming.
 */
function scoreModel(id: string): number {
  if (!/flash/i.test(id)) return -1;
  // "gemini-3.8-flash" -> 3.8
  const version = Number(/gemini-(\d+(?:\.\d+)?)/i.exec(id)?.[1] ?? 0);
  let score = version * 100;
  if (!/lite/i.test(id)) score += 40; // full Flash reads images better than Lite
  if (!/preview|exp|thinking/i.test(id)) score += 20; // previews get retired without notice
  if (/latest/i.test(id)) score -= 5; // prefer a pinned id over a moving alias
  return score;
}

/** Ask the key which models it can use, and pick the best one for reading food photos. */
export async function resolveModel(apiKey: string): Promise<string> {
  const models = await listModels(apiKey);
  if (models.length === 0) throw new Error('Your key returned no usable models.');
  const ranked = models
    .map((m) => ({ id: m.name, score: scoreModel(m.name) }))
    .sort((a, b) => b.score - a.score);
  // if nothing scored as a Flash model, fall back to whatever is available
  return ranked[0].score > 0 ? ranked[0].id : models[0].name;
}

/** Turn an API failure into something a person can act on, keeping Google's own wording. */
async function describeError(res: Response): Promise<string> {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message ?? '';
  } catch {
    /* response wasn't JSON */
  }
  if (res.status === 400 && /API key not valid/i.test(detail)) {
    return 'That API key was rejected. Check for a stray space or a missing character \u2014 copy it again from aistudio.google.com.';
  }
  if (res.status === 403) {
    return 'Your API key does not have access to this model. Try "Test key" in Settings to see which models you can use.';
  }
  if (res.status === 404) {
    return 'That model name was not found. Open Settings and pick one from the list.';
  }
  if (res.status === 429) {
    return 'You have hit the rate limit on your Gemini key. Wait a minute, or pick a Lite model in Settings.';
  }
  // Always surface what Google actually said; a bare "try again" hides real faults.
  const suffix = detail ? ` Google said: ${detail}` : '';
  if (res.status >= 500) {
    return `Google's servers returned an error (HTTP ${res.status}).${suffix}`;
  }
  return detail ? `${detail} (HTTP ${res.status})` : `The request failed (HTTP ${res.status}).`;
}

/** Models vary in what they accept, so we have a rich request and a plain one. */
function buildPayload(parts: unknown[], structured: boolean): string {
  if (structured) {
    return JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.3,
      },
    });
  }
  // Fallback: some models reject systemInstruction or responseSchema. Ask for JSON in words.
  const instruction = `${SYSTEM_PROMPT}

Reply with nothing but a JSON object of exactly this shape:
{"meal_name": string, "note": string, "items": [{"name": string, "quantity": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "confidence": "high" | "medium" | "low"}]}`;
  return JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: instruction }, ...parts] }],
    generationConfig: { temperature: 0.3 },
  });
}

/** Models sometimes wrap JSON in a markdown fence even when asked not to. */
function stripFence(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  return (fenced ? fenced[1] : text).trim();
}

async function callGemini(
  settings: Settings,
  parts: unknown[],
  onModelResolved?: (model: string) => void,
): Promise<AnalysisResult> {
  if (!settings.apiKey) {
    throw new Error('No API key set yet. Add one in Settings.');
  }

  const post = (model: string, structured: boolean) =>
    fetch(endpoint(model, settings.apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: buildPayload(parts, structured),
    });

  let model = settings.model;
  if (!model || model === 'auto') {
    model = await resolveModel(settings.apiKey);
    onModelResolved?.(model);
  }

  let res = await post(model, true);

  // A retired or renamed model gives a 404. Re-check what the key can use and retry once.
  if (res.status === 404) {
    const fresh = await resolveModel(settings.apiKey).catch(() => null);
    if (fresh && fresh !== model) {
      onModelResolved?.(fresh);
      model = fresh;
      res = await post(model, true);
    }
  }

  // Structured output isn't universally supported, and an unsupported schema can
  // come back as a 400 or a 500. Fall back to asking for JSON in the prompt.
  if (!res.ok && res.status !== 429) {
    const structuredError = await describeError(res);
    const plain = await post(model, false).catch(() => null);
    if (plain?.ok) {
      res = plain;
    } else {
      throw new Error(
        plain ? `${await describeError(plain)} (also tried without a response schema)` : structuredError,
      );
    }
  }

  if (!res.ok) throw new Error(await describeError(res));

  const body = await res.json();
  const text: string | undefined = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = body?.candidates?.[0]?.finishReason;
    if (reason === 'SAFETY') throw new Error('The model declined to analyse that.');
    if (reason === 'MAX_TOKENS') throw new Error('The reply was cut short. Try a simpler description.');
    throw new Error(`The model returned an empty response${reason ? ` (${reason})` : ''}. Try again.`);
  }

  let parsed: { meal_name?: string; items?: FoodItem[]; note?: string };
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    throw new Error('Could not read the model’s response. Try again.');
  }

  const items: FoodItem[] = (parsed.items ?? []).map((i) => ({
    name: String(i.name ?? 'Unknown'),
    quantity: String(i.quantity ?? ''),
    calories: Math.max(0, Math.round(Number(i.calories) || 0)),
    protein_g: Math.max(0, Math.round(Number(i.protein_g) || 0)),
    carbs_g: Math.max(0, Math.round(Number(i.carbs_g) || 0)),
    fat_g: Math.max(0, Math.round(Number(i.fat_g) || 0)),
    confidence: (['high', 'medium', 'low'] as const).includes(i.confidence) ? i.confidence : 'medium',
  }));

  if (items.length === 0) {
    throw new Error(parsed.note?.trim() || 'No food was recognised in that. Try another photo, or type it instead.');
  }

  return {
    mealName: parsed.meal_name?.trim() || items[0].name,
    items,
    totals: totalsOf(items),
    note: parsed.note?.trim() || undefined,
  };
}

export function totalsOf(items: FoodItem[]): Totals {
  return items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.calories,
      protein: a.protein + i.protein_g,
      carbs: a.carbs + i.carbs_g,
      fat: a.fat + i.fat_g,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Analyse a photo of a meal. `hint` is the optional text the user adds alongside. */
export async function analyzePhoto(
  file: Blob,
  settings: Settings,
  hint?: string,
  onModelResolved?: (model: string) => void,
): Promise<AnalysisResult> {
  const small = await forAnalysis(file);
  const data = await blobToBase64(small);
  const parts: unknown[] = [{ inlineData: { mimeType: 'image/jpeg', data } }];
  parts.push({
    text: hint?.trim()
      ? `Estimate the nutrition in this photo. The user adds: "${hint.trim()}". Treat their description as correct where it conflicts with the image.`
      : 'Estimate the nutrition in this photo.',
  });
  return callGemini(settings, parts, onModelResolved);
}

/** Analyse a typed or dictated description, with no photo. */
export async function analyzeText(
  description: string,
  settings: Settings,
  onModelResolved?: (model: string) => void,
): Promise<AnalysisResult> {
  const text = description.trim();
  if (!text) throw new Error('Describe what you ate first.');
  return callGemini(
    settings,
    [{ text: `Estimate the nutrition in this meal, described by the user: "${text}"` }],
    onModelResolved,
  );
}

export interface ModelInfo { name: string; displayName: string }

/** List the models this key can actually use — used by the "Test key" button. */
export async function listModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=200`);
  if (!res.ok) throw new Error(await describeError(res));
  const body = await res.json();
  const models: ModelInfo[] = (body?.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes('generateContent'),
    )
    .map((m: { name: string; displayName?: string }) => ({
      // the API returns "models/gemini-2.5-flash"; we store the bare id
      name: m.name.replace(/^models\//, ''),
      displayName: m.displayName ?? m.name,
    }))
    .filter((m: ModelInfo) => /gemini/i.test(m.name) && !/embedding|aqa|imagen|veo|tts/i.test(m.name));
  return models;
}
