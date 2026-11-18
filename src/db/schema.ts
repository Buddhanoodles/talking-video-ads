import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

/** Members the app has seen, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

export const actors = sqliteTable(
  "actors",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    gender: text("gender").notNull(),
    ageRange: text("age_range").notNull(),
    /** JSON array of lowercase tags. */
    tags: text("tags").notNull().default("[]"),
    portraitKey: text("portrait_key").notNull(),
    portraitType: text("portrait_type").notNull(),
    shared: integer("shared", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("actors_owner_idx").on(t.ownerId)],
);

export const batches = sqliteTable(
  "batches",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("batches_user_idx").on(t.userId)],
);

export const ads = sqliteTable(
  "ads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    batchId: text("batch_id"),
    hook: text("hook"),
    title: text("title").notNull(),
    script: text("script").notNull(),
    scriptLanguage: text("script_language").notNull(),
    language: text("language").notNull(),
    translatedScript: text("translated_script"),
    /** Kept when the actor is deleted: the ad then shows the actor as removed. */
    actorId: text("actor_id"),
    actorName: text("actor_name").notNull(),
    voice: text("voice").notNull(),
    direction: text("direction").notNull().default(""),
    aspectRatio: text("aspect_ratio").notNull(),
    /** draft | queued | processing | ready | failed */
    status: text("status").notNull(),
    /** translate | speech | video: the generation step running now. */
    step: text("step"),
    predictionId: text("prediction_id"),
    /** SHA-256 of the current job's webhook token. */
    hookTokenHash: text("hook_token_hash"),
    error: text("error"),
    videoKey: text("video_key"),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [
    index("ads_user_idx").on(t.userId),
    index("ads_batch_idx").on(t.batchId),
  ],
);
