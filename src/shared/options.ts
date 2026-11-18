// The fixed choices the forms offer, shared by pages and server.

export const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Polish",
  "Swedish",
  "Danish",
  "Norwegian",
  "Finnish",
  "Czech",
  "Romanian",
  "Hungarian",
  "Greek",
  "Turkish",
  "Russian",
  "Ukrainian",
  "Arabic",
  "Hebrew",
  "Hindi",
  "Bengali",
  "Indonesian",
  "Malay",
  "Thai",
  "Vietnamese",
  "Filipino",
  "Japanese",
  "Korean",
  "Chinese",
] as const;
export type Language = (typeof LANGUAGES)[number];

/** Each voice's label and the speech model's voice id. */
export const VOICES = [
  { id: "Wise_Woman", label: "Warm woman" },
  { id: "Calm_Woman", label: "Calm woman" },
  { id: "Lively_Girl", label: "Bright young woman" },
  { id: "Sweet_Girl_2", label: "Soft young woman" },
  { id: "Friendly_Person", label: "Friendly neutral" },
  { id: "Casual_Guy", label: "Casual man" },
  { id: "Deep_Voice_Man", label: "Deep man" },
  { id: "Determined_Man", label: "Confident man" },
  { id: "Patient_Man", label: "Patient man" },
  { id: "Elegant_Man", label: "Polished man" },
] as const;
export const VOICE_IDS = VOICES.map((v) => v.id) as [string, ...string[]];
export const voiceLabel = (id: string) =>
  VOICES.find((v) => v.id === id)?.label ?? id;

export const GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "nonbinary", label: "Non-binary" },
] as const;
export const genderLabel = (value: string) =>
  GENDERS.find((g) => g.value === value)?.label ?? value;

export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"] as const;

export const ASPECT_RATIOS = ["9:16", "1:1", "16:9"] as const;

export const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
] as const;

export const statusLabel = (value: string) =>
  STATUSES.find((s) => s.value === value)?.label ?? value;

export const SCRIPT_MAX = 1500;
export const MAX_HOOKS = 5;
export const MAX_BATCH_ACTORS = 5;
export const MAX_BATCH_LANGUAGES = 3;
export const MAX_VARIATIONS = 25;
export const PORTRAIT_MAX_BYTES = 10 * 1024 * 1024;
export const PORTRAIT_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The script a batch variation speaks. */
export function variationScript(hook: string, body: string): string {
  return `${hook.trim()} ${body.trim()}`;
}
