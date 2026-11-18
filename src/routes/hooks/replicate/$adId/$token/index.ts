import { createFileRoute } from "@tanstack/react-router";
import { handleWebhook } from "@/server/generation";
import type { Prediction } from "@/server/replicate";

// Public: Replicate calls it when a generation step finishes. The token in
// the path is the job's own; anything else is a 404.
export const Route = createFileRoute("/hooks/replicate/$adId/$token/")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { adId: string; token: string };
      }) => {
        const body = (await request
          .json()
          .catch(() => ({}))) as Partial<Prediction>;
        const known = await handleWebhook(
          params.adId,
          params.token,
          new URL(request.url).origin,
          body ?? {},
        );
        return known
          ? Response.json({ ok: true })
          : new Response("Not found", { status: 404 });
      },
    },
  },
});
