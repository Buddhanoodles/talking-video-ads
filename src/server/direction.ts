// The speech model takes one of a few emotions; the free-text direction
// picks the closest by keyword.
const EMOTIONS: [string, RegExp][] = [
  [
    "happy",
    /\b(happy|excited|upbeat|cheerful|joyful|enthusiastic|energetic|fun|playful|thrilled)\b/i,
  ],
  ["sad", /\b(sad|somber|melanchol\w*|emotional|heartfelt|tearful)\b/i],
  ["angry", /\b(angry|frustrated|annoyed|furious|outraged|ranting)\b/i],
  [
    "surprised",
    /\b(surprised|shocked|amazed|astonished|stunned|mind-?blown)\b/i,
  ],
  ["fearful", /\b(scared|afraid|fearful|nervous|anxious|worried)\b/i],
  ["disgusted", /\b(disgusted|grossed out|repulsed)\b/i],
  ["neutral", /\b(neutral|calm|flat|matter-of-fact|serious|informative)\b/i],
];

export function emotionFor(direction: string): string {
  for (const [emotion, pattern] of EMOTIONS) {
    if (pattern.test(direction)) return emotion;
  }
  return "auto";
}
