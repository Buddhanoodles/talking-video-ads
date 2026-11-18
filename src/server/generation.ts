// An ad's generation job: translate (when the language differs from the
// script's), speech, then a talking video of the actor's portrait. Each step
// is a Replicate prediction that calls /hooks/replicate/<ad>/<token> when
// done; the token is the job's own and only its hash is stored. The video
// step reads the portrait from /hooks/replicate/<ad>/<token>/portrait.
import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { db } from "@/db";
import { actors, ads } from "@/db/schema";
import { emotionFor } from "@/server/direction";
import {
  GenerationError,
  createPrediction,
  downloadOutput,
  type Prediction,
} from "@/server/replicate";

const TRANSLATE_MODEL = "meta/meta-llama-3-70b-instruct";
const SPEECH_MODEL = "minimax/speech-02-hd";
const VIDEO_MODEL = "bytedance/omni-human";

/** Languages the speech model can be told to favour. */
const SPEECH_LANGUAGES = new Set([
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Polish",
  "Turkish",
  "Russian",
  "Ukrainian",
  "Arabic",
  "Hindi",
  "Indonesian",
  "Thai",
  "Vietnamese",
  "Japanese",
  "Korean",
  "Chinese",
  "Czech",
  "Romanian",
  "Finnish",
  "Greek",
]);

type Ad = typeof ads.$inferSelect;
type Step = "translate" | "speech" | "video";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fail(adId: string, message: string) {
  await db
    .update(ads)
    .set({
      status: "failed",
      step: null,
      error: message.slice(0, 500),
      hookTokenHash: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(ads.id, adId));
}

function messageOf(error: unknown): string {
  return error instanceof GenerationError
    ? error.message
    : "Something went wrong while generating this video.";
}

async function runStep(
  ad: Ad,
  step: Step,
  token: string,
  origin: string,
  audioUrl?: string,
) {
  const webhook = `${origin}/hooks/replicate/${ad.id}/${token}`;
  let model: string;
  let input: Record<string, unknown>;
  if (step === "translate") {
    model = TRANSLATE_MODEL;
    input = {
      system_prompt:
        "You translate short spoken video ad scripts. Reply with the translation only, no notes or quotes.",
      prompt: `Translate this ad script from ${ad.scriptLanguage} into ${ad.language}. Keep it natural to say out loud${ad.direction ? ` in this tone: ${ad.direction}` : ""}.\n\n${ad.script}`,
      max_tokens: 2048,
      temperature: 0.2,
    };
  } else if (step === "speech") {
    model = SPEECH_MODEL;
    input = {
      text: ad.translatedScript ?? ad.script,
      voice_id: ad.voice,
      emotion: emotionFor(ad.direction),
      language_boost: SPEECH_LANGUAGES.has(ad.language) ? ad.language : "auto",
    };
  } else {
    if (!(await jobPortrait(ad))) {
      throw new GenerationError("The actor was removed.");
    }
    model = VIDEO_MODEL;
    input = {
      image: `${webhook}/portrait`,
      audio: audioUrl,
      aspect_ratio: ad.aspectRatio,
    };
  }
  const prediction = await createPrediction(model, input, webhook);
  await db
    .update(ads)
    .set({
      status: "processing",
      step,
      predictionId: prediction.id,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(ads.id, ad.id));
}

/** Start the job of a queued ad. Failures are kept on the ad. */
async function startGeneration(adId: string, origin: string) {
  const [ad] = await db.select().from(ads).where(eq(ads.id, adId));
  if (!ad || ad.status !== "queued") return;
  const token = newToken();
  await db
    .update(ads)
    .set({ hookTokenHash: await sha256(token), translatedScript: null })
    .where(eq(ads.id, adId));
  const fresh = { ...ad, translatedScript: null };
  try {
    await runStep(
      fresh,
      ad.language === ad.scriptLanguage ? "speech" : "translate",
      token,
      origin,
    );
  } catch (error) {
    await fail(adId, messageOf(error));
  }
}

export async function startAll(adIds: string[], origin: string) {
  for (const id of adIds) await startGeneration(id, origin);
}

function firstUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return firstUrl(output[output.length - 1]);
  if (output && typeof output === "object") {
    for (const key of ["video", "audio", "output", "url"]) {
      const value = (output as Record<string, unknown>)[key];
      if (typeof value === "string") return value;
    }
  }
  return null;
}

async function jobAd(adId: string, token: string): Promise<Ad | null> {
  const [ad] = await db.select().from(ads).where(eq(ads.id, adId));
  if (!ad?.hookTokenHash || ad.hookTokenHash !== (await sha256(token))) {
    return null;
  }
  return ad;
}

async function jobPortrait(ad: Ad) {
  if (!ad.actorId) return null;
  const [actor] = await db
    .select({ key: actors.portraitKey })
    .from(actors)
    .where(eq(actors.id, ad.actorId));
  return actor?.key ?? null;
}

/** The portrait a running job's video step reads, or null for a wrong token. */
export async function portraitForJob(adId: string, token: string) {
  const ad = await jobAd(adId, token);
  return ad && ad.step === "video" ? jobPortrait(ad) : null;
}

/**
 * A completion webhook: the finished prediction, as Replicate sends it.
 * Returns false when the token is wrong.
 */
export async function handleWebhook(
  adId: string,
  token: string,
  origin: string,
  prediction: Partial<Prediction>,
): Promise<boolean> {
  const ad = await jobAd(adId, token);
  if (!ad) return false;
  if (!ad.predictionId || prediction.id !== ad.predictionId) return true;
  if (prediction.status === "starting" || prediction.status === "processing") {
    return true;
  }
  // Claim this prediction, so a repeated webhook does nothing.
  const claimed = await db
    .update(ads)
    .set({ predictionId: null })
    .where(and(eq(ads.id, adId), eq(ads.predictionId, ad.predictionId)))
    .returning({ id: ads.id });
  if (!claimed.length) return true;
  try {
    if (prediction.status !== "succeeded") {
      await fail(
        adId,
        (typeof prediction.error === "string" && prediction.error) ||
          (prediction.status === "canceled"
            ? "Generation was canceled."
            : "Generation failed."),
      );
      return true;
    }
    if (ad.step === "translate") {
      const text = (
        Array.isArray(prediction.output)
          ? prediction.output.join("")
          : String(prediction.output ?? "")
      ).trim();
      if (!text) throw new GenerationError("The translation came back empty.");
      await db
        .update(ads)
        .set({ translatedScript: text.slice(0, 4000) })
        .where(eq(ads.id, adId));
      await runStep({ ...ad, translatedScript: text }, "speech", token, origin);
    } else if (ad.step === "speech") {
      const audio = firstUrl(prediction.output);
      if (!audio)
        throw new GenerationError("The speech step returned no audio.");
      await runStep(ad, "video", token, origin, audio);
    } else {
      const url = firstUrl(prediction.output);
      if (!url) throw new GenerationError("The video step returned no video.");
      const video = await downloadOutput(url);
      const key = `ads/${adId}/${crypto.randomUUID()}.mp4`;
      await env.files.put(key, video, {
        httpMetadata: { contentType: "video/mp4" },
      });
      await db
        .update(ads)
        .set({
          status: "ready",
          step: null,
          error: null,
          videoKey: key,
          hookTokenHash: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(ads.id, adId));
      if (ad.videoKey) await env.files.delete(ad.videoKey);
    }
  } catch (error) {
    await fail(adId, messageOf(error));
  }
  return true;
}
