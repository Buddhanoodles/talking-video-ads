import { env } from "cloudflare:workers";

/** An R2 object as a response, honouring a single byte Range. */
export async function serveFile(
  request: Request,
  key: string,
  extra: Record<string, string> = {},
): Promise<Response> {
  const head = await env.files.head(key);
  if (!head) return new Response("Not found", { status: 404 });
  const size = head.size;
  const headers = new Headers({
    "content-type":
      head.httpMetadata?.contentType ?? "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=3600",
    ...extra,
  });
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (match && (match[1] || match[2])) {
    let start = match[1] ? Number(match[1]) : size - Number(match[2]);
    let end = match[1] && match[2] ? Number(match[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) {
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${size}` },
      });
    }
    const part = await env.files.get(key, {
      range: { offset: start, length: end - start + 1 },
    });
    if (!part) return new Response("Not found", { status: 404 });
    headers.set("content-range", `bytes ${start}-${end}/${size}`);
    headers.set("content-length", String(end - start + 1));
    return new Response(part.body, { status: 206, headers });
  }
  const object = await env.files.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  headers.set("content-length", String(size));
  return new Response(object.body, { headers });
}
