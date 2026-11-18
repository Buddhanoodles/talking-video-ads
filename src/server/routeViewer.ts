import { env } from "cloudflare:workers";
import { getEveryAppUser } from "@every-app/sdk/server";
import type { Viewer } from "@/server/actors";
import { ActorError } from "@/server/actors";
import { viewerOf } from "@/server/viewer";

/** The member calling a server route, or a 401 response. */
export async function routeViewer(
  request: Request,
): Promise<Viewer | Response> {
  const user = await getEveryAppUser(request, env);
  if (!user)
    return Response.json(
      { error: "Sign in through the Gateway" },
      { status: 401 },
    );
  return viewerOf(user);
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ActorError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
