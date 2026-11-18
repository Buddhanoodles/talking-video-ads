import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Toggle } from "@/client/components/ui/toggle";
import {
  AGE_RANGES,
  GENDERS,
  PORTRAIT_MAX_BYTES,
  PORTRAIT_TYPES,
  genderLabel,
} from "@/shared/options";
import { getActors } from "@/serverFunctions/actors";

export const Route = createFileRoute("/actors")({
  loader: () => getActors(),
  head: () => ({ meta: [{ title: "Actors · Talking Video Ads" }] }),
  component: ActorsPage,
});

type Actor = ReturnType<typeof Route.useLoaderData>["actors"][number];

async function send(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "That didn't work.");
  }
}

function ActorsPage() {
  const { admin, actors } = Route.useLoaderData();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [editing, setEditing] = useState<Actor | "new" | null>(null);
  const [deleting, setDeleting] = useState<Actor | null>(null);
  const [pending, setPending] = useState(false);

  const allTags = useMemo(
    () => [...new Set(actors.flatMap((a) => a.tags))].sort(),
    [actors],
  );
  const shown = actors.filter(
    (a) =>
      a.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      tags.every((t) => a.tags.includes(t)),
  );

  async function share(actor: Actor) {
    try {
      await send(`/api/actors/${actor.id}/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shared: !actor.shared }),
      });
      await router.invalidate();
    } catch (cause) {
      toast.error((cause as Error).message);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Actors"
        actions={
          <Button data-testid="new-actor" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            New actor
          </Button>
        }
      />

      {actors.length === 0 ? (
        <EmptyState
          title="No actors yet"
          description="Upload a portrait to add the first person your ads can feature."
        />
      ) : (
        <div className="space-y-4">
          <Input
            data-testid="actors-search"
            placeholder="Search by name"
            aria-label="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {allTags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <Toggle
                  key={tag}
                  data-testid="tag-filter"
                  variant="outline"
                  size="sm"
                  pressed={tags.includes(tag)}
                  onPressedChange={(on) =>
                    setTags((t) =>
                      on ? [...t, tag] : t.filter((x) => x !== tag),
                    )
                  }
                >
                  {tag}
                </Toggle>
              ))}
            </div>
          ) : null}
          {shown.length === 0 ? (
            <EmptyState kind="filtered" title="No actors match" />
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {shown.map((actor) => (
                <li
                  key={actor.id}
                  data-testid="actor-card"
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <img
                    src={actor.portraitUrl}
                    alt={actor.name}
                    className="aspect-[4/5] w-full bg-muted object-cover"
                  />
                  <div className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{actor.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {genderLabel(actor.gender)} · {actor.ageRange}
                        </div>
                      </div>
                      <Badge variant={actor.shared ? "soft" : "outline"}>
                        {actor.shared ? "Shared" : "Private"}
                      </Badge>
                    </div>
                    {actor.tags.length ? (
                      <div className="flex flex-wrap gap-1">
                        {actor.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {actor.canEdit || admin ? (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {actor.canEdit ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Edit ${actor.name}`}
                              data-testid="actor-edit"
                              onClick={() => setEditing(actor)}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Delete ${actor.name}`}
                              data-testid="actor-delete"
                              onClick={() => setDeleting(actor)}
                            >
                              <Trash2 />
                            </Button>
                          </>
                        ) : null}
                        {admin ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="ml-auto"
                            data-testid="actor-share"
                            onClick={() => void share(actor)}
                          >
                            {actor.shared ? "Make private" : "Share"}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editing ? (
        <ActorDialog
          actor={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await router.invalidate();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            setPending(true);
            try {
              await send(`/api/actors/${deleting.id}`, { method: "DELETE" });
              setDeleting(null);
              await router.invalidate();
            } catch (cause) {
              toast.error((cause as Error).message);
            } finally {
              setPending(false);
            }
          }}
        >
          Ads already made with this actor keep their videos.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

function ActorDialog({
  actor,
  onClose,
  onSaved,
}: {
  actor: Actor | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(actor?.name ?? "");
  const [gender, setGender] = useState(actor?.gender ?? "female");
  const [ageRange, setAgeRange] = useState(actor?.ageRange ?? "25-34");
  const [tags, setTags] = useState(actor?.tags.join(", ") ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    if (!name.trim()) return setError("Give the actor a name.");
    if (!actor && !file) return setError("Choose a portrait.");
    if (file && !PORTRAIT_TYPES.includes(file.type))
      return setError("Use a JPEG, PNG or WebP image.");
    if (file && file.size > PORTRAIT_MAX_BYTES)
      return setError("The image must be 10 MB or smaller.");
    const form = new FormData();
    form.set("name", name);
    form.set("gender", gender);
    form.set("ageRange", ageRange);
    form.set("tags", tags);
    if (file) form.set("portrait", file);
    setSaving(true);
    try {
      await send(actor ? `/api/actors/${actor.id}` : "/api/actors", {
        method: "POST",
        body: form,
      });
      await onSaved();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{actor ? "Edit actor" : "New actor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="actor-name">Name</Label>
            <Input
              id="actor-name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actor-portrait">
              {actor ? "New portrait" : "Portrait"}
            </Label>
            <Input
              id="actor-portrait"
              type="file"
              accept={PORTRAIT_TYPES.join(",")}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              JPEG, PNG or WebP, up to 10 MB.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="actor-gender">Gender</Label>
              <ChoiceSelect
                id="actor-gender"
                testId="actor-gender"
                value={gender}
                onChange={setGender}
                items={GENDERS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actor-age">Age</Label>
              <ChoiceSelect
                id="actor-age"
                testId="actor-age"
                value={ageRange}
                onChange={setAgeRange}
                items={AGE_RANGES.map((a) => ({ value: a, label: a }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="actor-tags">Tags</Label>
            <Input
              id="actor-tags"
              placeholder="kitchen, car, office"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" data-testid="actor-save" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
