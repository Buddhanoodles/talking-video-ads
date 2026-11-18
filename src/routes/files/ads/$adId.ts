import { createFileRoute } from "@tanstack/react-router";
import { videoOf } from "@/server/ads";
import { routeViewer } from "@/server/routeViewer";
import { serveFile } from "@/server/serveFile";

export const Route = createFileRoute("/files/ads/$adId")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { adId: string };
      }) => {
        const viewer = await routeViewer(request);
        if (viewer instanceof Response) return viewer;
        const video = await videoOf(viewer, params.adId);
        if (!video) return new Response("Not found", { status: 404 });
        const download = new URL(request.url).searchParams.has("download");
        const name =
          video.title
            .replace(/[^\w-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80) || "ad";
        return serveFile(
          request,
          video.key,
          download
            ? { "content-disposition": `attachment; filename="${name}.mp4"` }
            : {},
        );
      },
    },
  },
});
