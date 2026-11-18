import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { listActors } from "@/server/actors";
import { viewerOf } from "@/server/viewer";

export const getActors = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const viewer = await viewerOf(context.user);
    return { admin: viewer.admin, actors: await listActors(viewer) };
  });
