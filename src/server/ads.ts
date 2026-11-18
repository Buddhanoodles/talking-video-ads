import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { db } from "@/db";
import { actors, ads, batches, users } from "@/db/schema";
import { findVisibleActor, type Viewer } from "@/server/actors";
import { combinations } from "@/server/combinations";
import {
  ASPECT_RATIOS,
  LANGUAGES,
  MAX_BATCH_ACTORS,
  MAX_BATCH_LANGUAGES,
  MAX_HOOKS,
  MAX_VARIATIONS,
  SCRIPT_MAX,
  VOICE_IDS,
  variationScript,
} from "@/shared/options";

class AdError extends Error {}

const title = z.string().trim().min(1, "Title is required").max(120);
const common = {
  scriptLanguage: z.enum(LANGUAGES),
  voice: z.enum(VOICE_IDS),
  direction: z.string().trim().max(300).default(""),
  aspectRatio: z.enum(ASPECT_RATIOS),
};

export const adInput = z
  .object({
    title,
    script: z
      .string()
      .trim()
      .min(1, "Write a script")
      .max(SCRIPT_MAX, `Scripts are at most ${SCRIPT_MAX} characters`),
    actorId: z.string().min(1, "Choose an actor"),
    language: z.enum(LANGUAGES),
    generate: z.boolean(),
    ...common,
  })
  .strict();
export const draftInput = adInput.extend({ id: z.string() });
export const idInput = z.object({ id: z.string() }).strict();
export const renameInput = z.object({ id: z.string(), title }).strict();

export const batchInput = z
  .object({
    title,
    hooks: z
      .array(z.string().trim().min(1, "Fill in every hook").max(300))
      .min(1)
      .max(MAX_HOOKS),
    body: z.string().trim().min(1, "Write the body").max(SCRIPT_MAX),
    actorIds: z
      .array(z.string())
      .min(1, "Choose an actor")
      .max(MAX_BATCH_ACTORS),
    languages: z
      .array(z.enum(LANGUAGES))
      .min(1, "Choose a language")
      .max(MAX_BATCH_LANGUAGES),
    ...common,
  })
  .strict()
  .refine(
    (b) =>
      b.hooks.length * b.actorIds.length * b.languages.length <= MAX_VARIATIONS,
    `At most ${MAX_VARIATIONS} videos per batch`,
  )
  .refine(
    (b) =>
      b.hooks.every(
        (hook) => variationScript(hook, b.body).length <= SCRIPT_MAX,
      ),
    `Each hook plus the body must be at most ${SCRIPT_MAX} characters`,
  );

const now = () => new Date().toISOString();

/** Own ads, or every member's for an admin who asks. */
export async function listAds(viewer: Viewer, everyone: boolean) {
  const all = everyone && viewer.admin;
  const rows = await db
    .select({
      id: ads.id,
      title: ads.title,
      actorName: ads.actorName,
      actorExists: actors.id,
      language: ads.language,
      aspectRatio: ads.aspectRatio,
      status: ads.status,
      batchId: ads.batchId,
      batchTitle: batches.title,
      createdAt: ads.createdAt,
      ownerEmail: users.email,
    })
    .from(ads)
    .leftJoin(actors, eq(actors.id, ads.actorId))
    .leftJoin(batches, eq(batches.id, ads.batchId))
    .leftJoin(users, eq(users.id, ads.userId))
    .where(all ? undefined : eq(ads.userId, viewer.id))
    .orderBy(desc(ads.createdAt), ads.id);
  return rows.map(({ actorExists, ownerEmail, ...row }) => ({
    ...row,
    actorRemoved: !actorExists,
    ownerEmail: all ? ownerEmail : null,
  }));
}

/** An ad this viewer may see: their own, or any for an admin. */
async function readable(viewer: Viewer, id: string) {
  const [ad] = await db
    .select()
    .from(ads)
    .where(
      viewer.admin
        ? eq(ads.id, id)
        : and(eq(ads.id, id), eq(ads.userId, viewer.id)),
    );
  return ad ?? null;
}

async function own(viewer: Viewer, id: string) {
  const [ad] = await db
    .select()
    .from(ads)
    .where(and(eq(ads.id, id), eq(ads.userId, viewer.id)));
  if (!ad) throw new AdError("No ad with that id");
  return ad;
}

export async function getAd(viewer: Viewer, id: string) {
  const ad = await readable(viewer, id);
  if (!ad) return null;
  const actor = ad.actorId ? await findVisibleActor(viewer, ad.actorId) : null;
  const [exists] = ad.actorId
    ? await db
        .select({ id: actors.id })
        .from(actors)
        .where(eq(actors.id, ad.actorId))
    : [];
  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, ad.userId));
  const [batch] = ad.batchId
    ? await db
        .select({ id: batches.id, title: batches.title })
        .from(batches)
        .where(eq(batches.id, ad.batchId))
    : [];
  return {
    id: ad.id,
    title: ad.title,
    script: ad.script,
    scriptLanguage: ad.scriptLanguage,
    language: ad.language,
    translatedScript: ad.translatedScript,
    actorId: ad.actorId,
    actorName: ad.actorName,
    actorRemoved: !exists,
    portraitUrl: actor
      ? `/files/actors/${actor.id}?v=${actor.portraitKey.split("/").pop()}`
      : null,
    voice: ad.voice,
    direction: ad.direction,
    aspectRatio: ad.aspectRatio,
    status: ad.status,
    error: ad.error,
    hasVideo: Boolean(ad.videoKey),
    batch: batch ?? null,
    hook: ad.hook,
    createdAt: ad.createdAt,
    mine: ad.userId === viewer.id,
    ownerEmail: owner?.email ?? null,
  };
}

async function usableActor(viewer: Viewer, actorId: string) {
  const actor = await findVisibleActor(viewer, actorId);
  if (!actor) throw new AdError("Choose an actor");
  return actor;
}

export async function createAd(viewer: Viewer, input: z.infer<typeof adInput>) {
  const actor = await usableActor(viewer, input.actorId);
  const { generate, ...fields } = input;
  const [ad] = await db
    .insert(ads)
    .values({
      ...fields,
      id: crypto.randomUUID(),
      userId: viewer.id,
      actorName: actor.name,
      status: generate ? "queued" : "draft",
    })
    .returning({ id: ads.id, status: ads.status });
  return ad!;
}

export async function updateDraft(
  viewer: Viewer,
  input: z.infer<typeof draftInput>,
) {
  const ad = await own(viewer, input.id);
  if (ad.status !== "draft") throw new AdError("Only drafts can be edited");
  const actor = await usableActor(viewer, input.actorId);
  const { generate, id, ...fields } = input;
  await db
    .update(ads)
    .set({
      ...fields,
      actorName: actor.name,
      status: generate ? "queued" : "draft",
      updatedAt: now(),
    })
    .where(eq(ads.id, id));
  return { id, status: generate ? "queued" : "draft" };
}

export async function renameAd(
  viewer: Viewer,
  input: z.infer<typeof renameInput>,
) {
  await own(viewer, input.id);
  await db
    .update(ads)
    .set({ title: input.title, updatedAt: now() })
    .where(eq(ads.id, input.id));
}

export async function duplicateAd(viewer: Viewer, id: string) {
  const ad = await own(viewer, id);
  const [copy] = await db
    .insert(ads)
    .values({
      id: crypto.randomUUID(),
      userId: viewer.id,
      title: `${ad.title} (copy)`.slice(0, 120),
      script: ad.script,
      scriptLanguage: ad.scriptLanguage,
      language: ad.language,
      actorId: ad.actorId,
      actorName: ad.actorName,
      voice: ad.voice,
      direction: ad.direction,
      aspectRatio: ad.aspectRatio,
      status: "draft",
    })
    .returning({ id: ads.id });
  return copy!;
}

export async function deleteAd(viewer: Viewer, id: string) {
  const ad = await readable(viewer, id);
  if (!ad) throw new AdError("No ad with that id");
  await db.delete(ads).where(eq(ads.id, id));
  if (ad.videoKey) await env.files.delete(ad.videoKey);
}

export async function retryAd(viewer: Viewer, id: string) {
  const ad = await own(viewer, id);
  if (ad.status !== "failed")
    throw new AdError("Only failed ads can be retried");
  await db
    .update(ads)
    .set({ status: "queued", error: null, step: null, updatedAt: now() })
    .where(eq(ads.id, id));
}

export async function videoOf(viewer: Viewer, id: string) {
  const ad = await readable(viewer, id);
  return ad?.videoKey ? { key: ad.videoKey, title: ad.title } : null;
}

export async function createBatch(
  viewer: Viewer,
  input: z.infer<typeof batchInput>,
) {
  const actorIds = [...new Set(input.actorIds)];
  const languages = [...new Set(input.languages)];
  const found = await Promise.all(
    actorIds.map((id) => usableActor(viewer, id)),
  );
  const names = new Map(found.map((a) => [a.id, a.name]));
  const batchId = crypto.randomUUID();
  const rows = combinations(input.hooks, actorIds, languages).map((c) => ({
    id: crypto.randomUUID(),
    userId: viewer.id,
    batchId,
    hook: c.hook,
    title:
      `${input.title} · Hook ${c.hookIndex + 1} · ${names.get(c.actorId)} · ${c.language}`.slice(
        0,
        160,
      ),
    script: variationScript(c.hook, input.body),
    scriptLanguage: input.scriptLanguage,
    language: c.language,
    actorId: c.actorId,
    actorName: names.get(c.actorId)!,
    voice: input.voice,
    direction: input.direction,
    aspectRatio: input.aspectRatio,
    status: "queued",
  }));
  await db.batch([
    db.insert(batches).values({
      id: batchId,
      userId: viewer.id,
      title: input.title,
      body: input.body,
    }),
    ...rows.map((row) => db.insert(ads).values(row)),
  ]);
  return { id: batchId, adIds: rows.map((r) => r.id) };
}

export async function getBatch(viewer: Viewer, id: string) {
  const [batch] = await db
    .select()
    .from(batches)
    .where(
      viewer.admin
        ? eq(batches.id, id)
        : and(eq(batches.id, id), eq(batches.userId, viewer.id)),
    );
  if (!batch) return null;
  const variations = await db
    .select({
      id: ads.id,
      hook: ads.hook,
      actorName: ads.actorName,
      language: ads.language,
      status: ads.status,
      error: ads.error,
      videoKey: ads.videoKey,
    })
    .from(ads)
    .where(eq(ads.batchId, id))
    .orderBy(ads.createdAt, sql`rowid`);
  return {
    id: batch.id,
    title: batch.title,
    body: batch.body,
    mine: batch.userId === viewer.id,
    variations: variations.map(({ videoKey, ...v }) => ({
      ...v,
      hasVideo: Boolean(videoKey),
    })),
  };
}

/** Failed ads of this viewer's batch, set back to queued. */
export async function retryFailedInBatch(
  viewer: Viewer,
  batchId: string,
  adId?: string,
) {
  const rows = await db
    .update(ads)
    .set({ status: "queued", error: null, step: null, updatedAt: now() })
    .where(
      and(
        eq(ads.batchId, batchId),
        eq(ads.userId, viewer.id),
        eq(ads.status, "failed"),
        adId ? inArray(ads.id, [adId]) : undefined,
      ),
    )
    .returning({ id: ads.id });
  return rows.map((r) => r.id);
}
