import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import {
  DeliveryFields,
  EMPTY_AD,
  type AdValues,
} from "@/client/components/AdForm";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { GenerationOff } from "@/client/components/GenerationOff";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import {
  LANGUAGES,
  MAX_BATCH_ACTORS,
  MAX_BATCH_LANGUAGES,
  MAX_HOOKS,
  MAX_VARIATIONS,
  SCRIPT_MAX,
  type Language,
} from "@/shared/options";
import { createBatch, getComposer } from "@/serverFunctions/ads";

export const Route = createFileRoute("/batches/new")({
  loader: () => getComposer(),
  head: () => ({ meta: [{ title: "New batch · Talking Video Ads" }] }),
  component: NewBatch,
});

function toggle<T>(list: T[], item: T, on: boolean): T[] {
  return on ? [...list, item] : list.filter((x) => x !== item);
}

function NewBatch() {
  const { actors, ready } = Route.useLoaderData();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [hooks, setHooks] = useState([""]);
  const [body, setBody] = useState("");
  const [actorIds, setActorIds] = useState<string[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [delivery, setDelivery] = useState<AdValues>(EMPTY_AD);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const count = hooks.length * actorIds.length * languages.length;
  const tooMany = count > MAX_VARIATIONS;

  async function submit() {
    setError(null);
    if (!title.trim()) return setError("Give the batch a title.");
    if (hooks.some((h) => !h.trim())) return setError("Fill in every hook.");
    if (!body.trim()) return setError("Write the body.");
    if (!actorIds.length) return setError("Choose at least one actor.");
    if (!languages.length) return setError("Choose at least one language.");
    setPending(true);
    try {
      const batch = await createBatch({
        data: {
          title,
          hooks,
          body,
          actorIds,
          languages,
          voice: delivery.voice,
          direction: delivery.direction,
          scriptLanguage: delivery.scriptLanguage,
          aspectRatio: delivery.aspectRatio,
        },
      });
      await navigate({
        to: "/batches/$batchId",
        params: { batchId: batch.id },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="New batch"
        backLink={
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Ads
          </Link>
        }
      />
      {ready ? null : <GenerationOff />}
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="batch-title">Title</Label>
          <Input
            id="batch-title"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Hooks</legend>
          {hooks.map((hook, i) => (
            <div key={i} className="flex gap-2">
              <Input
                id={`hook-${i}`}
                aria-label={`Hook ${i + 1}`}
                placeholder={`Hook ${i + 1}`}
                maxLength={300}
                value={hook}
                onChange={(e) =>
                  setHooks((h) =>
                    h.map((x, j) => (j === i ? e.target.value : x)),
                  )
                }
              />
              {hooks.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove hook ${i + 1}`}
                  onClick={() => setHooks((h) => h.filter((_, j) => j !== i))}
                >
                  <X />
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="batch-add-hook"
            disabled={hooks.length >= MAX_HOOKS}
            onClick={() => setHooks((h) => [...h, ""])}
          >
            <Plus aria-hidden />
            Add hook
          </Button>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="batch-body">Body</Label>
          <Textarea
            id="batch-body"
            rows={5}
            maxLength={SCRIPT_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">
            Actors{" "}
            <span className="font-normal text-muted-foreground">
              (up to {MAX_BATCH_ACTORS})
            </span>
          </legend>
          {actors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <Link to="/actors" className="underline">
                Add an actor
              </Link>{" "}
              first.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {actors.map((actor) => {
                const checked = actorIds.includes(actor.id);
                return (
                  <label
                    key={actor.id}
                    data-testid="batch-actor"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card p-2 text-sm has-data-checked:border-primary"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!checked && actorIds.length >= MAX_BATCH_ACTORS}
                      onCheckedChange={(on) =>
                        setActorIds((ids) => toggle(ids, actor.id, on))
                      }
                    />
                    <img
                      src={actor.portraitUrl}
                      alt=""
                      className="size-8 rounded-full object-cover"
                    />
                    <span className="truncate">{actor.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">
            Spoken in{" "}
            <span className="font-normal text-muted-foreground">
              (up to {MAX_BATCH_LANGUAGES})
            </span>
          </legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {LANGUAGES.map((language) => {
              const checked = languages.includes(language);
              return (
                <label
                  key={language}
                  data-testid="batch-language"
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    disabled={
                      !checked && languages.length >= MAX_BATCH_LANGUAGES
                    }
                    onCheckedChange={(on) =>
                      setLanguages((l) => toggle(l, language, on))
                    }
                  />
                  {language}
                </label>
              );
            })}
          </div>
        </fieldset>

        <DeliveryFields
          values={delivery}
          set={(patch) => setDelivery((d) => ({ ...d, ...patch }))}
          withLanguage={false}
        />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span
            data-testid="batch-count"
            className={
              tooMany
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {hooks.length} × {actorIds.length} × {languages.length} = {count}{" "}
            {count === 1 ? "video" : "videos"}
            {tooMany ? ` (max ${MAX_VARIATIONS})` : ""}
          </span>
          <Button
            type="submit"
            data-testid="batch-submit"
            disabled={!ready || pending || tooMany || count === 0}
          >
            {pending ? "Starting…" : "Generate batch"}
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
