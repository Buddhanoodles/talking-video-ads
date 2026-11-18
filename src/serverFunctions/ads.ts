import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { waitUntil } from "cloudflare:workers";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as adsQ from "@/server/ads";
import { listActors } from "@/server/actors";
import { startAll } from "@/server/generation";
import { generationReady } from "@/server/replicate";
import { viewerOf } from "@/server/viewer";

function startInBackground(adIds: string[]) {
  if (!adIds.length) return;
  const origin = new URL(getRequest().url).origin;
  waitUntil(startAll(adIds, origin));
}

async function requireGeneration() {
  if (!(await generationReady())) {
    throw new Error("Video generation isn't set up.");
  }
}

export const getAdsPage = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => z.object({ everyone: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const viewer = await viewerOf(context.user);
    return {
      admin: viewer.admin,
      ads: await adsQ.listAds(viewer, data.everyone),
    };
  });

/** What the ad and batch forms offer. */
export const getComposer = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const viewer = await viewerOf(context.user);
    const [actors, ready] = await Promise.all([
      listActors(viewer),
      generationReady(),
    ]);
    return {
      actors: actors.map((a) => ({
        id: a.id,
        name: a.name,
        portraitUrl: a.portraitUrl,
      })),
      ready,
    };
  });

export const getAd = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => adsQ.idInput.parse(data))
  .handler(async ({ data, context }) => {
    const viewer = await viewerOf(context.user);
    return adsQ.getAd(viewer, data.id);
  });

export const createAd = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => adsQ.adInput.parse(data))
  .handler(async ({ data, context }) => {
    const viewer = await viewerOf(context.user);
    if (data.generate) await requireGeneration();
    const ad = await adsQ.createAd(viewer, data);
    if (data.generate) startInBackground([ad.id]);
    return ad;
  });

export const updateDraft = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => adsQ.draftInput.parse(data))
  .handler(async ({ data, context }) => {
    const viewer = await viewerOf(context.user);
    if (data.generate) await requireGeneration();
    const ad = await adsQ.updateDraft(viewer, data);
    if (data.generate) startInBackground([ad.id]);
    return ad;
  });

export const renameAd = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => adsQ.renameInput.parse(data))
  .handler(async ({ data, context }) =>
    adsQ.renameAd(await viewerOf(context.user), data),
  );

export const duplicateAd = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => adsQ.idInput.parse(data))
  .handler(async ({ data, context }) =>
    adsQ.duplicateAd(await viewerOf(context.user), data.id),
  );

export const deleteAd = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => adsQ.idInput.parse(data))
  .handler(async ({ data, context }) =>
    adsQ.deleteAd(await viewerOf(context.user), data.id),
  );

export const retryAd = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => adsQ.idInput.parse(data))
  .handler(async ({ data, context }) => {
    const viewer = await viewerOf(context.user);
    await requireGeneration();
    await adsQ.retryAd(viewer, data.id);
    startInBackground([data.id]);
  });

export const createBatch = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => adsQ.batchInput.parse(data))
  .handler(async ({ data, context }) => {
    const viewer = await viewerOf(context.user);
    await requireGeneration();
    const batch = await adsQ.createBatch(viewer, data);
    startInBackground(batch.adIds);
    return { id: batch.id };
  });

export const getBatch = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => adsQ.idInput.parse(data))
  .handler(async ({ data, context }) =>
    adsQ.getBatch(await viewerOf(context.user), data.id),
  );

export const retryBatch = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    z
      .object({ id: z.string(), adId: z.string().optional() })
      .strict()
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const viewer = await viewerOf(context.user);
    await requireGeneration();
    startInBackground(
      await adsQ.retryFailedInBatch(viewer, data.id, data.adId),
    );
  });
