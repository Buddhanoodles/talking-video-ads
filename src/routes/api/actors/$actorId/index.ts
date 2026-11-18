import { createFileRoute } from "@tanstack/react-router";
import { deleteActor, updateActor } from "@/server/actors";
import { errorResponse, routeViewer } from "@/server/routeViewer";

type Args = { request: Request; params: { actorId: string } };

export const Route = createFileRoute("/api/actors/$actorId/")({
  server: {
    handlers: {
      POST: async ({ request, params }: Args) => {
        const viewer = await routeViewer(request);
        if (viewer instanceof Response) return viewer;
        try {
          const form = await request.formData();
          return Response.json({
            actor: await updateActor(viewer, params.actorId, form),
          });
        } catch (error) {
          return errorResponse(error);
        }
      },
      DELETE: async ({ request, params }: Args) => {
        const viewer = await routeViewer(request);
        if (viewer instanceof Response) return viewer;
        try {
          await deleteActor(viewer, params.actorId);
          return new Response(null, { status: 204 });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
