import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { shareActor } from "@/server/actors";
import { errorResponse, routeViewer } from "@/server/routeViewer";

export const Route = createFileRoute("/api/actors/$actorId/share")({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { actorId: string };
      }) => {
        const viewer = await routeViewer(request);
        if (viewer instanceof Response) return viewer;
        const body = z
          .object({ shared: z.boolean() })
          .safeParse(await request.json().catch(() => null));
        if (!body.success)
          return Response.json(
            { error: "Send { shared: boolean }" },
            { status: 400 },
          );
        try {
          return Response.json({
            actor: await shareActor(viewer, params.actorId, body.data.shared),
          });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
