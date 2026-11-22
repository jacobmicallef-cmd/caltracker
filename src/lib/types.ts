export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'high' | 'athlete';
export type GoalDir = 'lose' | 'maintain' | 'gain';

export interface FoodItem {
  name: string;
  quantity: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface Totals { kcal: number; protein: number; carbs: number; fat: number }

export interface Entry {
  id: string;
  /** local calendar day, YYYY-MM-DD */
  date: string;
  /** ms epoch of when it was logged */
  loggedAt: number;
  name: string;
  items: FoodItem[];
  totals: Totals;
  source: 'photo' | 'text' | 'manual' | 'saved';
  /** compressed thumbnail, stored as a Blob in IndexedDB */
  photo?: Blob;
  note?: string;
}

export interface WeightLog { date: string; kg: number }

export interface SavedFood {
  id: string;
  name: string;
  servingLabel: string;
  totals: Totals;
  usedCount: number;
}

export interface Settings {
  apiKey: string;
  model: string;
  /** profile */
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goalDir: GoalDir;
  /** kg per week, always positive */
  rateKgPerWeek: number;
  goalWeightKg: number;
  /** if set, these override the calculated targets */
  customTargets?: Totals;
  units: 'metric' | 'imperial';
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'auto',
  sex: 'male',
  age: 17,
  heightCm: 175,
  weightKg: 61,
  activity: 'moderate',
  goalDir: 'gain',
  rateKgPerWeek: 0.25,
  goalWeightKg: 65.1,
  units: 'metric',
};
