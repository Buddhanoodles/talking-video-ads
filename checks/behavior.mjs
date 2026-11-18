// F001-F004 main paths, with a Gateway whose replicate key is set.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import {
  adStatus,
  createActor,
  deliverUntilDone,
  fakeGatewayOptions,
  pick,
  portraitPng,
  predictions,
} from "./lib.mjs";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const runtime = await startRuntime(fakeGatewayOptions);
try {
  const page = await (await runtime.context("member")).newPage();

  // --- F001: actor library ---------------------------------------------
  await page.goto("/actors");
  await runtime.assertBackLink(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "Actors" }),
  ).toBeVisible();

  const dir = await mkdtemp(path.join(tmpdir(), "portraits-"));
  const portraitFile = path.join(dir, "maya.png");
  await writeFile(portraitFile, portraitPng([214, 222, 236], [181, 136, 112]));
  await page.getByTestId("new-actor").click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#actor-name").fill("Maya");
  await dialog.locator("#actor-portrait").setInputFiles(portraitFile);
  await pick(page, "actor-gender", "Female");
  await pick(page, "actor-age", "25-34");
  await dialog.locator("#actor-tags").fill("Kitchen, home");
  await dialog.getByTestId("actor-save").click();
  await expect(dialog).toBeHidden();
  const maya = page.getByTestId("actor-card").filter({ hasText: "Maya" });
  await expect(maya).toBeVisible();
  await expect(maya).toContainText("kitchen");
  await expect(maya).toContainText("Female");
  await expect(maya).toContainText("Private");
  const portraitSrc = await maya.locator("img").getAttribute("src");
  const portrait = await runtime.fetch(portraitSrc, { role: "member" });
  expect(portrait.status).toBe(200);
  expect(portrait.headers.get("content-type")).toBe("image/png");

  const daniel = await createActor(runtime, "member", {
    name: "Daniel",
    gender: "male",
    ageRange: "35-44",
    tags: ["car", "outdoors"],
    colors: [
      [220, 228, 214],
      [120, 92, 74],
    ],
  });
  await createActor(runtime, "member", {
    name: "Priya",
    gender: "female",
    ageRange: "18-24",
    tags: ["office"],
    colors: [
      [236, 226, 214],
      [150, 104, 84],
    ],
  });

  // Refused uploads: wrong type and too large.
  const bad = new FormData();
  bad.set("name", "Gif person");
  bad.set(
    "portrait",
    new Blob([Buffer.from("GIF89a")], { type: "image/gif" }),
    "a.gif",
  );
  expect(
    (
      await runtime.fetch("/api/actors", {
        role: "member",
        method: "POST",
        body: bad,
      })
    ).status,
  ).toBe(400);
  const big = new FormData();
  big.set("name", "Huge");
  big.set(
    "portrait",
    new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: "image/png" }),
    "big.png",
  );
  expect(
    (
      await runtime.fetch("/api/actors", {
        role: "member",
        method: "POST",
        body: big,
      })
    ).status,
  ).toBe(400);

  await page.reload();
  await expect(page.getByTestId("actor-card")).toHaveCount(3);
  await page.getByTestId("tag-filter").filter({ hasText: "car" }).click();
  await expect(page.getByTestId("actor-card")).toHaveCount(1);
  await expect(page.getByTestId("actor-card")).toContainText("Daniel");
  await page.getByTestId("tag-filter").filter({ hasText: "car" }).click();
  await page.getByTestId("actors-search").fill("pri");
  await expect(page.getByTestId("actor-card")).toHaveCount(1);
  await expect(page.getByTestId("actor-card")).toContainText("Priya");
  await page.getByTestId("actors-search").fill("");

  // Edit own actor.
  const priya = page.getByTestId("actor-card").filter({ hasText: "Priya" });
  await priya.getByTestId("actor-edit").click();
  await page.getByRole("dialog").locator("#actor-tags").fill("office, desk");
  await page.getByRole("dialog").getByTestId("actor-save").click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(priya).toContainText("desk");

  // --- F002: one ad, translated, through every status --------------------
  await page.goto("/ads/new");
  await expect(page.getByTestId("generation-off")).toHaveCount(0);
  await page.locator("#ad-title").fill("Blender launch, Spanish");
  await page
    .locator("#ad-script")
    .fill(
      "I made smoothies every morning this week and the blender cleaned itself in ten seconds.",
    );
  await pick(page, "ad-actor", "Maya");
  await pick(page, "ad-voice", "Bright young woman");
  await page.locator("#ad-direction").fill("Excited, like telling a friend");
  await pick(page, "ad-language", "Spanish");
  await page
    .getByTestId("ad-ratio")
    .getByRole("button", { name: "1:1" })
    .click();
  await page.getByTestId("ad-generate").click();
  await page.waitForURL(/\/ads\/(?!new$)[\w-]+$/);
  const adId = page.url().split("/").pop();
  await expect(page.getByTestId("ad-status")).toHaveText(/Queued|Processing/);
  const done = await deliverUntilDone(runtime, [adId]);
  expect(done[adId]).toBe("ready");
  const steps = (await predictions(runtime)).filter((p) =>
    p.webhook?.includes(adId),
  );
  expect(steps.length).toBe(3);
  expect(steps[0].input.prompt ?? "").toContain("blender");
  expect(steps[1].input.text).toBe("Texto traducido para el anuncio.");
  await page.reload();
  await expect(page.getByTestId("ad-status")).toHaveText("Ready");
  await expect(page.getByTestId("ad-translated")).toContainText(
    "Texto traducido para el anuncio.",
  );
  await expect(page.getByTestId("ad-video")).toBeVisible();
  await expect(page.getByTestId("ad-detail")).toContainText("1:1");
  const href = await page.getByTestId("ad-download").getAttribute("href");
  const video = await runtime.fetch(href, { role: "member" });
  expect(video.status).toBe(200);
  expect(video.headers.get("content-type")).toBe("video/mp4");
  expect(video.headers.get("content-disposition")).toContain("attachment");
  const ranged = await runtime.fetch(href.split("?")[0], {
    role: "member",
    headers: { range: "bytes=0-99" },
  });
  expect(ranged.status).toBe(206);

  // A failure keeps its message and can be retried.
  await page.goto("/ads/new");
  await page.locator("#ad-title").fill("Car charger review");
  await page
    .locator("#ad-script")
    .fill(
      "This flaky old charger finally got replaced, and the new one fits every port in my car.",
    );
  await pick(page, "ad-actor", "Daniel");
  await page.getByTestId("ad-generate").click();
  await page.waitForURL(/\/ads\/(?!new$)[\w-]+$/);
  const flakyId = page.url().split("/").pop();
  expect((await deliverUntilDone(runtime, [flakyId]))[flakyId]).toBe("failed");
  await page.reload();
  await expect(page.getByTestId("ad-status")).toHaveText("Failed");
  await expect(page.getByTestId("ad-error")).toContainText(
    "The model ran out of capacity.",
  );
  await page.getByTestId("ad-retry").click();
  await expect(page.getByTestId("ad-status")).toHaveText(/Queued|Processing/);
  expect((await deliverUntilDone(runtime, [flakyId]))[flakyId]).toBe("ready");
  await page.reload();
  await expect(page.getByTestId("ad-status")).toHaveText("Ready");
  await expect(page.getByTestId("ad-error")).toHaveCount(0);

  // Rename, duplicate as a draft, delete.
  await page.getByTestId("ad-rename").click();
  await page
    .getByRole("dialog")
    .locator("#rename-title")
    .fill("Car charger review v2");
  await page.getByRole("dialog").getByTestId("rename-save").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Car charger review v2",
  );
  await page.getByTestId("ad-duplicate").click();
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith("/ads/") && !url.pathname.endsWith(flakyId),
  );
  const draftId = page.url().split("/").pop();
  await expect(page.getByTestId("ad-status")).toHaveText("Draft");
  await expect(page.locator("#ad-title")).toHaveValue(
    "Car charger review v2 (copy)",
  );
  await expect(page.locator("#ad-script")).toHaveValue(
    /new one fits every port/,
  );
  await page.getByTestId("ad-delete").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await page.waitForURL((url) => url.pathname === "/");
  expect(await adStatus(runtime, draftId)).toBeNull();

  // --- F003: batch variations --------------------------------------------
  await page.goto("/batches/new");
  await page.locator("#batch-title").fill("Spring blender push");
  await page
    .locator("#hook-0")
    .fill("Stop scrolling if you hate cleaning your blender.");
  await page.getByTestId("batch-add-hook").click();
  await page
    .locator("#hook-1")
    .fill("This is the only kitchen gadget I use daily.");
  await page.getByTestId("batch-add-hook").click();
  await page
    .locator("#hook-2")
    .fill("My morning routine just got ten minutes shorter.");
  await page
    .locator("#batch-body")
    .fill(
      "It blends frozen fruit in seconds and rinses itself clean. Grab yours with the link below.",
    );
  await page.getByTestId("batch-actor").filter({ hasText: "Maya" }).click();
  await page.getByTestId("batch-actor").filter({ hasText: "Priya" }).click();
  await page
    .getByTestId("batch-language")
    .filter({ hasText: "English" })
    .click();
  await page
    .getByTestId("batch-language")
    .filter({ hasText: "French" })
    .click();
  await expect(page.getByTestId("batch-count")).toContainText("12");
  await page.getByTestId("batch-submit").click();
  await page.waitForURL(/\/batches\/(?!new$)[\w-]+$/);
  const batchId = page.url().split("/").pop();
  await expect(page.getByTestId("variation-row")).toHaveCount(12);
  const db = await runtime.database();
  const { results } = await db
    .prepare("select id, script from ads where batch_id = ?")
    .bind(batchId)
    .all();
  expect(results.length).toBe(12);
  expect(
    results.every((r) =>
      r.script.endsWith(
        "It blends frozen fruit in seconds and rinses itself clean. Grab yours with the link below.",
      ),
    ),
  ).toBe(true);
  const finished = await deliverUntilDone(
    runtime,
    results.map((r) => r.id),
  );
  expect(Object.values(finished).every((s) => s === "ready")).toBe(true);
  await page.reload();
  await expect(page.getByTestId("batch-counts")).toContainText("12 ready");
  await expect(page.getByTestId("batch-counts")).toContainText("0 failed");
  const first = page.getByTestId("variation-row").first();
  await expect(first).toContainText("Ready");
  const variationHref = await first
    .getByTestId("variation-download")
    .getAttribute("href");
  expect((await runtime.fetch(variationHref, { role: "member" })).status).toBe(
    200,
  );

  // Too many combinations are refused before submitting.
  await page.goto("/batches/new");
  for (let i = 0; i < 4; i++) await page.getByTestId("batch-add-hook").click();
  await expect(page.getByTestId("batch-add-hook")).toBeDisabled();

  // --- F004: ad library ----------------------------------------------------
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Ads" }),
  ).toBeVisible();
  await expect(page.getByTestId("ads-page")).toContainText("Page 1 of 2");
  await expect(page.getByTestId("ad-row")).toHaveCount(10);
  await page.getByTestId("ads-next").click();
  await expect(page.getByTestId("ad-row")).toHaveCount(4);
  await page.getByTestId("ads-search").fill("blender launch");
  await expect(page.getByTestId("ad-row")).toHaveCount(1);
  await expect(page.getByTestId("ad-row")).toContainText("Spanish");
  await expect(page.getByTestId("ad-row")).toContainText("Maya");
  await page.getByTestId("ads-search").fill("");
  await pick(page, "ads-actor-filter", "Daniel");
  await expect(page.getByTestId("ad-row")).toHaveCount(1);
  await expect(page.getByTestId("ad-row")).toContainText(
    "Car charger review v2",
  );
  await pick(page, "ads-actor-filter", "All actors");
  await page.getByRole("button", { name: "Title" }).click();
  await expect(page.getByTestId("ad-row").first()).toContainText(
    "Blender launch, Spanish",
  );
  await pick(page, "ads-status-filter", "Failed");
  await expect(page.getByTestId("ad-row")).toHaveCount(0);
  await pick(page, "ads-status-filter", "All statuses");

  // Deleting an actor keeps its ads.
  await page.goto("/actors");
  await page
    .getByTestId("actor-card")
    .filter({ hasText: "Daniel" })
    .getByTestId("actor-delete")
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByTestId("actor-card")).toHaveCount(2);
  await page.goto(`/ads/${flakyId}`);
  await expect(page.getByTestId("ad-actor")).toHaveText("Actor removed");
  await expect(page.getByTestId("ad-status")).toHaveText("Ready");

  // Phone-sized smoke.
  const phone = await (
    await runtime.context("member", {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage();
  await phone.goto("/");
  await expect(
    phone.getByRole("heading", { level: 1, name: "Ads" }),
  ).toBeVisible();
  await expect(phone.getByTestId("ads-table")).toBeVisible();
  await phone.goto(`/batches/${batchId}`);
  await expect(phone.getByTestId("batch-counts")).toBeVisible();
  const overflow = await phone.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // The public picture: the finished batch.
  await page.goto(`/batches/${batchId}`);
  await expect(page.getByTestId("batch-counts")).toContainText("12 ready");
  await runtime.screenshot(page);
} finally {
  await runtime.close();
}
