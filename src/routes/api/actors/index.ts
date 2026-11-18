import { createFileRoute } from "@tanstack/react-router";
import { createActor, listActors } from "@/server/actors";
import { errorResponse, routeViewer } from "@/server/routeViewer";

export const Route = createFileRoute("/api/actors/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const viewer = await routeViewer(request);
        if (viewer instanceof Response) return viewer;
        return Response.json({ actors: await listActors(viewer) });
      },
      POST: async ({ request }: { request: Request }) => {
        const viewer = await routeViewer(request);
        if (viewer instanceof Response) return viewer;
        try {
          const form = await request.formData();
          const actor = await createActor(viewer, form);
          return Response.json({ actor }, { status: 201 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
