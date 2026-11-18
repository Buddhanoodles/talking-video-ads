import { createFileRoute } from "@tanstack/react-router";
import { portraitForJob } from "@/server/generation";
import { serveFile } from "@/server/serveFile";

// Public: the video model reads the actor's portrait from here while the
// job's video step runs. Any other token, or time, is a 404.
export const Route = createFileRoute("/hooks/replicate/$adId/$token/portrait")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { adId: string; token: string };
      }) => {
        const key = await portraitForJob(params.adId, params.token);
        if (!key) return new Response("Not found", { status: 404 });
        return serveFile(request, key, { "cache-control": "no-store" });
      },
    },
  },
});
