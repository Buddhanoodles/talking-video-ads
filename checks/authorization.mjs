// Who may reach what, with the default Gateway (replicate not configured).
import {
  startRuntime,
  expect,
} from "/home/user/oss-new/control/runtime/index.mjs";
import { createActor, pick } from "./lib.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess([
    "/",
    "/actors",
    "/ads/new",
    "/batches/new",
    "/api/actors",
  ]);

  const ownerActor = await createActor(runtime, "owner", {
    name: "Owner private",
    tags: ["studio"],
  });
  const memberActor = await createActor(runtime, "member", {
    name: "Member private",
    tags: ["car"],
  });

  // Anonymous and outsiders reach no file or API route.
  for (const role of [undefined, "outsider"]) {
    for (const p of ["/api/actors", `/files/actors/${memberActor.id}`]) {
      const res = await runtime.fetch(p, role ? { role } : {});
      expect([401, 403, 404], `${role} ${p}`).toContain(res.status);
    }
    const post = await runtime.fetch(`/api/actors/${memberActor.id}`, {
      ...(role ? { role } : {}),
      method: "DELETE",
    });
    expect([401, 403, 404]).toContain(post.status);
  }

  // Private actors stay with their creator.
  const memberList = await (
    await runtime.fetch("/api/actors", { role: "member" })
  ).json();
  expect(memberList.actors.map((a) => a.name)).toEqual(["Member private"]);
  expect(
    (await runtime.fetch(`/files/actors/${ownerActor.id}`, { role: "member" }))
      .status,
  ).toBe(404);
  const edit = new FormData();
  edit.set("name", "Taken over");
  expect(
    (
      await runtime.fetch(`/api/actors/${ownerActor.id}`, {
        role: "member",
        method: "POST",
        body: edit,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await runtime.fetch(`/api/actors/${ownerActor.id}`, {
        role: "member",
        method: "DELETE",
      })
    ).status,
  ).toBe(404);

  // Only admins share.
  const share = (role, id, shared) =>
    runtime.fetch(`/api/actors/${id}/share`, {
      role,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shared }),
    });
  expect((await share("member", memberActor.id, true)).status).toBe(403);
  expect((await share("member", ownerActor.id, true)).status).toBe(403);
  // Admins see every actor and may edit any.
  const ownerList = await (
    await runtime.fetch("/api/actors", { role: "owner" })
  ).json();
  expect(ownerList.actors.map((a) => a.name).sort()).toEqual([
    "Member private",
    "Owner private",
  ]);
  expect((await share("owner", ownerActor.id, true)).status).toBe(200);
  const afterShare = await (
    await runtime.fetch("/api/actors", { role: "member" })
  ).json();
  expect(afterShare.actors.map((a) => a.name).sort()).toEqual([
    "Member private",
    "Owner private",
  ]);
  expect(
    (await runtime.fetch(`/files/actors/${ownerActor.id}`, { role: "member" }))
      .status,
  ).toBe(200);
  // Shared still isn't editable by others.
  expect(
    (
      await runtime.fetch(`/api/actors/${ownerActor.id}`, {
        role: "member",
        method: "POST",
        body: edit,
      })
    ).status,
  ).toBe(403);

  // Generation is off without the replicate key: a notice, a disabled button.
  const owner = await (await runtime.context("owner")).newPage();
  await owner.goto("/ads/new");
  await expect(owner.getByTestId("generation-off")).toBeVisible();
  await expect(owner.getByTestId("ad-generate")).toBeDisabled();
  await owner.locator("#ad-title").fill("Owner draft");
  await owner.locator("#ad-script").fill("A script only the owner wrote.");
  await pick(owner, "ad-actor", "Owner private");
  await owner.getByTestId("ad-save-draft").click();
  await owner.waitForURL(/\/ads\/(?!new$)[\w-]+$/);
  const ownerAdId = owner.url().split("/").pop();
  await owner.goto("/batches/new");
  await expect(owner.getByTestId("generation-off")).toBeVisible();
  await expect(owner.getByTestId("batch-submit")).toBeDisabled();

  const member = await (await runtime.context("member")).newPage();
  await member.goto("/ads/new");
  await member.locator("#ad-title").fill("Member draft");
  await member.locator("#ad-script").fill("A script only the member wrote.");
  await pick(member, "ad-actor", "Member private");
  await member.getByTestId("ad-save-draft").click();
  await member.waitForURL(/\/ads\/(?!new$)[\w-]+$/);
  const memberAdId = member.url().split("/").pop();

  // A member never sees another member's ad.
  await member.goto("/");
  await expect(member.getByTestId("ad-row")).toHaveCount(1);
  await expect(member.getByTestId("ads-table")).not.toContainText(
    "Owner draft",
  );
  await expect(member.getByTestId("ads-scope")).toHaveCount(0);
  await member.goto(`/ads/${ownerAdId}`);
  await expect(member.getByTestId("ad-not-found")).toBeVisible();
  await expect(member.getByTestId("ad-delete")).toHaveCount(0);
  expect(
    (await runtime.fetch(`/files/ads/${ownerAdId}`, { role: "member" })).status,
  ).toBe(404);

  // Admins read every ad, change none, and may delete.
  await owner.goto("/");
  await owner
    .getByTestId("ads-scope")
    .getByRole("button", { name: "Everyone" })
    .click();
  await expect(owner.getByTestId("ad-row")).toHaveCount(2);
  await expect(owner.getByTestId("ads-table")).toContainText(
    "member@example.test",
  );
  await owner.goto(`/ads/${memberAdId}`);
  await expect(owner.getByRole("heading", { level: 1 })).toHaveText(
    "Member draft",
  );
  await expect(owner.getByTestId("ad-rename")).toHaveCount(0);
  await expect(owner.getByTestId("ad-duplicate")).toHaveCount(0);
  await expect(owner.locator("#ad-title")).toHaveCount(0);
  await owner.getByTestId("ad-delete").click();
  await owner
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await owner.waitForURL((url) => url.pathname === "/");
  await member.goto("/");
  await expect(member.getByTestId("ad-row")).toHaveCount(0);

  // The completion webhook is public but takes only a valid per-job token.
  const hook = await runtime.fetch(
    `/hooks/replicate/${ownerAdId}/not-the-token`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "x", status: "succeeded" }),
    },
  );
  expect(hook.status).toBe(404);
  expect(
    (await runtime.fetch(`/hooks/replicate/${ownerAdId}/not-the-token`)).status,
  ).not.toBe(200);
  expect(
    (
      await runtime.fetch(
        `/hooks/replicate/${ownerAdId}/not-the-token/portrait`,
      )
    ).status,
  ).toBe(404);
  // No other route is public.
  expect([401, 403]).toContain(
    (await runtime.fetch(`/ads/${ownerAdId}`)).status,
  );

  // No sign-in of the app's own.
  for (const p of ["/login", "/signin", "/signup", "/logout"]) {
    expect((await runtime.fetch(p, { role: "member" })).status, p).toBe(404);
  }
  await member.goto("/");
  await expect(member.locator('input[type="password"]')).toHaveCount(0);
} finally {
  await runtime.close();
}
