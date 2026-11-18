import { createFileRoute } from "@tanstack/react-router";
import { findVisibleActor } from "@/server/actors";
import { routeViewer } from "@/server/routeViewer";
import { serveFile } from "@/server/serveFile";

export const Route = createFileRoute("/files/actors/$actorId")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { actorId: string };
      }) => {
        const viewer = await routeViewer(request);
        if (viewer instanceof Response) return viewer;
        const actor = await findVisibleActor(viewer, params.actorId);
        if (!actor) return new Response("Not found", { status: 404 });
        return serveFile(request, actor.portraitKey);
      },
    },
  },
});
