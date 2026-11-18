// Actors, portraits and ads survive a restart.
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { createActor, pick } from "./lib.mjs";

const runtime = await startRuntime();
try {
  const actor = await createActor(runtime, "member", {
    name: "Lena",
    tags: ["garden"],
  });
  const before = Buffer.from(
    await (
      await runtime.fetch(`/files/actors/${actor.id}`, { role: "member" })
    ).arrayBuffer(),
  );
  const page = await (await runtime.context("member")).newPage();
  await page.goto("/ads/new");
  await page.locator("#ad-title").fill("Garden hose teaser");
  await page
    .locator("#ad-script")
    .fill("The hose that never kinks, even around the tomato beds.");
  await pick(page, "ad-actor", "Lena");
  await page.getByTestId("ad-save-draft").click();
  await page.waitForURL(/\/ads\/(?!new$)[\w-]+$/);
  const adId = page.url().split("/").pop();

  await runtime.restart();

  const list = await (
    await runtime.fetch("/api/actors", { role: "member" })
  ).json();
  expect(list.actors.map((a) => a.name)).toEqual(["Lena"]);
  expect(list.actors[0].tags).toEqual(["garden"]);
  const after = Buffer.from(
    await (
      await runtime.fetch(`/files/actors/${actor.id}`, { role: "member" })
    ).arrayBuffer(),
  );
  expect(after.equals(before)).toBe(true);
  const again = await (await runtime.context("member")).newPage();
  await again.goto(`/ads/${adId}`);
  await expect(again.getByTestId("ad-status")).toHaveText("Draft");
  await expect(again.locator("#ad-script")).toHaveValue(
    "The hose that never kinks, even around the tomato beds.",
  );
  await again.goto("/");
  await expect(again.getByTestId("ad-row")).toContainText("Garden hose teaser");
} finally {
  await runtime.close();
}
