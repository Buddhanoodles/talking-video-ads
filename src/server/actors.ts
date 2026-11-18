import { and, eq, or } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { db } from "@/db";
import { actors } from "@/db/schema";
import {
  AGE_RANGES,
  GENDERS,
  PORTRAIT_MAX_BYTES,
  PORTRAIT_TYPES,
} from "@/shared/options";

export interface Viewer {
  id: string;
  admin: boolean;
}

interface Actor {
  id: string;
  name: string;
  gender: string;
  ageRange: string;
  tags: string[];
  shared: boolean;
  mine: boolean;
  canEdit: boolean;
  portraitUrl: string;
}

type Row = typeof actors.$inferSelect;

function shown(row: Row, viewer: Viewer): Actor {
  const mine = row.ownerId === viewer.id;
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    ageRange: row.ageRange,
    tags: JSON.parse(row.tags) as string[],
    shared: row.shared,
    mine,
    canEdit: mine || viewer.admin,
    portraitUrl: `/files/actors/${row.id}?v=${row.portraitKey.split("/").pop()}`,
  };
}

/** Own actors and shared ones; an admin sees every actor. */
function visible(viewer: Viewer) {
  return viewer.admin
    ? undefined
    : or(eq(actors.ownerId, viewer.id), eq(actors.shared, true));
}

export async function listActors(viewer: Viewer): Promise<Actor[]> {
  const rows = await db
    .select()
    .from(actors)
    .where(visible(viewer))
    .orderBy(actors.name, actors.id);
  return rows.map((row) => shown(row, viewer));
}

export async function findVisibleActor(viewer: Viewer, id: string) {
  const [row] = await db
    .select()
    .from(actors)
    .where(and(eq(actors.id, id), visible(viewer)));
  return row ?? null;
}

export class ActorError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const fields = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  gender: z.enum(GENDERS.map((g) => g.value) as [string, ...string[]]),
  ageRange: z.enum(AGE_RANGES),
  tags: z
    .string()
    .max(500)
    .transform((value) => [
      ...new Set(
        value
          .split(",")
          .map((tag) => tag.trim().toLowerCase().slice(0, 30))
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(z.string()).max(12, "At most 12 tags")),
});

function readFields(form: FormData, current?: Row) {
  const value = (name: string, fallback: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : fallback;
  };
  const parsed = fields.safeParse({
    name: value("name", current?.name ?? ""),
    gender: value("gender", current?.gender ?? "female"),
    ageRange: value("ageRange", current?.ageRange ?? "25-34"),
    tags: value(
      "tags",
      current ? (JSON.parse(current.tags) as string[]).join(",") : "",
    ),
  });
  if (!parsed.success)
    throw new ActorError(parsed.error.issues[0]!.message, 400);
  return parsed.data;
}

function readPortrait(form: FormData, required: boolean): File | null {
  const file = form.get("portrait");
  if (!(file instanceof File) || file.size === 0) {
    if (required) throw new ActorError("Choose a portrait image", 400);
    return null;
  }
  if (!PORTRAIT_TYPES.includes(file.type))
    throw new ActorError("The portrait must be a JPEG, PNG or WebP image", 400);
  if (file.size > PORTRAIT_MAX_BYTES)
    throw new ActorError("The portrait must be 10 MB or smaller", 400);
  return file;
}

async function storePortrait(actorId: string, file: File) {
  const key = `actors/${actorId}/${crypto.randomUUID()}`;
  await env.files.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  return key;
}

export async function createActor(
  viewer: Viewer,
  form: FormData,
): Promise<Actor> {
  const data = readFields(form);
  const portrait = readPortrait(form, true)!;
  const id = crypto.randomUUID();
  const portraitKey = await storePortrait(id, portrait);
  const [row] = await db
    .insert(actors)
    .values({
      id,
      ownerId: viewer.id,
      name: data.name,
      gender: data.gender,
      ageRange: data.ageRange,
      tags: JSON.stringify(data.tags),
      portraitKey,
      portraitType: portrait.type,
    })
    .returning();
  return shown(row!, viewer);
}

/** The actor this viewer may change: their own, or any for an admin. */
async function editable(viewer: Viewer, id: string): Promise<Row> {
  const row = await findVisibleActor(viewer, id);
  if (!row) throw new ActorError("No actor with that id", 404);
  if (row.ownerId !== viewer.id && !viewer.admin)
    throw new ActorError(
      "Only its creator or an admin can change this actor",
      403,
    );
  return row;
}

export async function updateActor(
  viewer: Viewer,
  id: string,
  form: FormData,
): Promise<Actor> {
  const current = await editable(viewer, id);
  const data = readFields(form, current);
  const portrait = readPortrait(form, false);
  const portraitKey = portrait
    ? await storePortrait(id, portrait)
    : current.portraitKey;
  const [row] = await db
    .update(actors)
    .set({
      name: data.name,
      gender: data.gender,
      ageRange: data.ageRange,
      tags: JSON.stringify(data.tags),
      portraitKey,
      portraitType: portrait?.type ?? current.portraitType,
    })
    .where(eq(actors.id, id))
    .returning();
  if (portrait) await env.files.delete(current.portraitKey);
  return shown(row!, viewer);
}

/** Ads made with it keep their videos and show the actor as removed. */
export async function deleteActor(viewer: Viewer, id: string) {
  const current = await editable(viewer, id);
  await db.delete(actors).where(eq(actors.id, id));
  await env.files.delete(current.portraitKey);
}

export async function shareActor(viewer: Viewer, id: string, shared: boolean) {
  if (!viewer.admin) throw new ActorError("Only admins can share actors", 403);
  const [row] = await db
    .update(actors)
    .set({ shared })
    .where(eq(actors.id, id))
    .returning();
  if (!row) throw new ActorError("No actor with that id", 404);
  return shown(row, viewer);
}
