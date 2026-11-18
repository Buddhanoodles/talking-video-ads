// Shared helpers for the suites: portrait images, a fake Gateway that answers
// the replicate capability like a configured one, and webhook delivery.
import { deflateSync } from "node:zlib";
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** A 160x200 PNG portrait: a soft gradient with a round "face". */
export function portraitPng([r1, g1, b1], [r2, g2, b2]) {
  const w = 160,
    h = 200;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const t = y / h;
      const face =
        (x - 80) ** 2 + (y - 80) ** 2 < 45 ** 2 ||
        (x - 80) ** 2 / 70 ** 2 + (y - 200) ** 2 / 70 ** 2 < 1;
      const [r, g, b] = face
        ? [r2, g2, b2]
        : [
            r1 + (r2 - r1) * t * 0.3,
            g1 + (g2 - g1) * t * 0.3,
            b1 + (b2 - b1) * t * 0.3,
          ];
      row.set([r, g, b].map(Math.round), 1 + x * 3);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Create an actor through the app's upload route. */
export async function createActor(
  runtime,
  role,
  { name, gender = "female", ageRange = "25-34", tags = [], colors },
) {
  const form = new FormData();
  form.set("name", name);
  form.set("gender", gender);
  form.set("ageRange", ageRange);
  form.set("tags", tags.join(", "));
  form.set(
    "portrait",
    new Blob(
      [
        portraitPng(
          ...(colors ?? [
            [200, 210, 225],
            [170, 130, 110],
          ]),
        ),
      ],
      { type: "image/png" },
    ),
    "portrait.png",
  );
  const res = await runtime.fetch("/api/actors", {
    role,
    method: "POST",
    body: form,
  });
  expect(res.status, await res.clone().text()).toBe(201);
  return (await res.json()).actor;
}

export const FAKE_GATEWAY = "fake-gateway";

// A Gateway whose replicate key is set: it answers the capability's status
// and creates predictions the way Replicate's API does (POST only, as the
// catalog allows). Video outputs come back as data URLs. The first
// prediction whose input mentions "flaky" fails, once.
const FAKE_SOURCE = `
const predictions = new Map();
const failedOnce = new Set();
let n = 0;
const PREFIX = "/api/integrations/replicate/api.replicate.com";
const json = (body, status = 200) => Response.json(body, { status });
const VIDEO = "data:video/mp4;base64," + btoa(String.fromCharCode(0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50) + "x".repeat(4000));
export default { async fetch(request) {
  const url = new URL(request.url);
  const p = url.pathname;
  if (p === "/__predictions") return json([...predictions.values()]);
  if (p === "/api/integrations/replicate") return json({ requested: true, configured: true, ready: true });
  if (!p.startsWith(PREFIX)) return json({ code: "capability_not_requested" }, 403);
  const rest = p.slice(PREFIX.length);
  if (request.method !== "POST") return Response.json({ code: "integration_read_only" }, { status: 403, headers: { "x-everyapp-error": "integration_read_only" } });
  const model = rest.match(/^\\/v1\\/models\\/([^/]+\\/[^/]+)\\/predictions$/);
  if (!model) return json({ detail: "Not found" }, 404);
  const body = await request.json();
  const id = "pred" + ++n;
  const text = JSON.stringify(body.input);
  let status = "succeeded", error = null, output;
  if (text.includes("flaky") && !failedOnce.has(model[1])) {
    failedOnce.add(model[1]);
    status = "failed";
    error = "The model ran out of capacity.";
  } else if (/llama|instruct/i.test(model[1])) output = ["Texto traducido ", "para el anuncio."];
  else if (typeof body.input.text === "string") output = "https://replicate.delivery/fake/" + id + "/speech.mp3";
  else output = VIDEO;
  predictions.set(id, { id, model: model[1], input: body.input, webhook: body.webhook, status, error, output: status === "succeeded" ? output : null });
  return json({ id, status: "starting" }, 201);
} };`;

export const fakeGatewayOptions = {
  bindings: { EVERY_APP_GATEWAY: { type: "worker", worker: FAKE_GATEWAY } },
  workers: [
    {
      config: {
        name: FAKE_GATEWAY,
        compatibilityDate: "2025-09-01",
        manifest: {
          mainModule: "fake.mjs",
          modules: { "fake.mjs": { type: "esm", contents: FAKE_SOURCE } },
        },
      },
    },
  ],
};

export async function predictions(runtime) {
  const worker = await runtime.mf.getWorker(FAKE_GATEWAY);
  const res = await worker.fetch("http://fake/__predictions");
  return res.json();
}

export async function adStatus(runtime, id) {
  const db = await runtime.database();
  const row = await db
    .prepare("select status from ads where id = ?")
    .bind(id)
    .first();
  return row?.status ?? null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Deliver Replicate's completion webhooks for the given ads until each is
 * ready or failed. Returns the final statuses.
 */
const deliveredOnce = new Set();
export async function deliverUntilDone(
  runtime,
  adIds,
  delivered = deliveredOnce,
) {
  const wanted = new Set(adIds);
  for (let round = 0; round < 200; round++) {
    const statuses = await Promise.all(
      adIds.map((id) => adStatus(runtime, id)),
    );
    if (statuses.every((s) => s === "ready" || s === "failed"))
      return Object.fromEntries(adIds.map((id, i) => [id, statuses[i]]));
    for (const pred of await predictions(runtime)) {
      if (delivered.has(pred.id) || !pred.webhook) continue;
      const hook = new URL(pred.webhook);
      expect(hook.hostname).toBe(runtime.hostname);
      const adId = hook.pathname.split("/")[3];
      if (!wanted.has(adId)) continue;
      delivered.add(pred.id);
      if (typeof pred.input.image === "string") {
        // The video model reads the portrait anonymously from the app.
        const image = new URL(pred.input.image);
        expect(image.hostname).toBe(runtime.hostname);
        const portrait = await runtime.fetch(image.pathname);
        expect(portrait.status).toBe(200);
        expect(portrait.headers.get("content-type")).toMatch(/^image\//);
      }
      const { webhook, model, input, ...prediction } = pred;
      const res = await runtime.fetch(hook.pathname + hook.search, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prediction),
      });
      expect(res.status, await res.clone().text()).toBeLessThan(300);
    }
    await sleep(100);
  }
  throw new Error("Ads did not finish: " + adIds.join(", "));
}

/** Pick an option in a Base UI select by its trigger's test id. */
export async function pick(page, testId, option) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
