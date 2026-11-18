import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdForm } from "@/client/components/AdForm";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { GenerationOff } from "@/client/components/GenerationOff";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/client/components/ui/alert";
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
import { Spinner } from "@/client/components/ui/spinner";
import { formatDate } from "@/client/lib/format";
import { voiceLabel, type Language } from "@/shared/options";
import {
  deleteAd,
  duplicateAd,
  getAd,
  getComposer,
  renameAd,
  retryAd,
  updateDraft,
} from "@/serverFunctions/ads";

export const Route = createFileRoute("/ads/$adId")({
  loader: async ({ params }) => {
    const [ad, composer] = await Promise.all([
      getAd({ data: { id: params.adId } }),
      getComposer(),
    ]);
    return { ad, composer };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.ad?.title ?? "Ad"} · Talking Video Ads` }],
  }),
  component: AdPage,
});

const back = (
  <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
    ← Ads
  </Link>
);

function AdPage() {
  const { ad, composer } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);
  const working = ad?.status === "queued" || ad?.status === "processing";

  // Follow a running job until it settles.
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => void router.invalidate(), 3000);
    return () => clearInterval(timer);
  }, [working, router]);

  if (!ad) {
    return (
      <AppShell nav={<AppNav />}>
        <PageHeader title="Ad not found" backLink={back} />
        <div data-testid="ad-not-found">
          <EmptyState
            kind="filtered"
            title="This ad doesn't exist or isn't yours"
            action={<Button render={<Link to="/" />}>Back to ads</Button>}
          />
        </div>
      </AppShell>
    );
  }

  async function act(work: () => Promise<unknown>) {
    setPending(true);
    try {
      await work();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "That didn't work.");
    } finally {
      setPending(false);
    }
  }

  const isDraft = ad.status === "draft" && ad.mine;

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={ad.title}
        backLink={back}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ad.status} testId="ad-status" />
            <span>{formatDate(ad.createdAt)}</span>
            {ad.mine ? null : <span>{ad.ownerEmail}</span>}
          </span>
        }
        actions={
          <>
            {ad.mine ? (
              <>
                <Button
                  variant="outline"
                  data-testid="ad-rename"
                  onClick={() => setRenaming(true)}
                >
                  Rename
                </Button>
                <Button
                  variant="outline"
                  data-testid="ad-duplicate"
                  disabled={pending}
                  onClick={() =>
                    act(async () => {
                      const copy = await duplicateAd({ data: { id: ad.id } });
                      await navigate({
                        to: "/ads/$adId",
                        params: { adId: copy.id },
                      });
                    })
                  }
                >
                  Duplicate
                </Button>
              </>
            ) : null}
            <Button
              variant="destructive"
              data-testid="ad-delete"
              onClick={() => setDeleting(true)}
            >
              Delete
            </Button>
          </>
        }
      />

      {isDraft ? (
        <>
          {composer.ready ? null : <GenerationOff />}
          <AdForm
            key={ad.id}
            initial={{
              title: ad.title,
              script: ad.script,
              actorId: composer.actors.some((a) => a.id === ad.actorId)
                ? ad.actorId!
                : "",
              voice: ad.voice,
              direction: ad.direction,
              scriptLanguage: ad.scriptLanguage as Language,
              language: ad.language as Language,
              aspectRatio: ad.aspectRatio as "9:16",
            }}
            actors={composer.actors}
            ready={composer.ready}
            onSubmit={async (values, generate) => {
              await updateDraft({ data: { ...values, id: ad.id, generate } });
              if (!generate) toast.success("Draft saved");
              await router.invalidate();
            }}
          />
        </>
      ) : (
        <div className="space-y-6" data-testid="ad-detail">
          {ad.status === "ready" && ad.hasVideo ? (
            <div className="space-y-3">
              <video
                data-testid="ad-video"
                src={`/files/ads/${ad.id}`}
                controls
                playsInline
                className="max-h-[70vh] w-full rounded-xl border border-border bg-muted"
              />
              <Button
                variant="outline"
                data-testid="ad-download"
                render={<a href={`/files/ads/${ad.id}?download=1`} download />}
              >
                <Download aria-hidden />
                Download MP4
              </Button>
            </div>
          ) : null}
          {working ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <Spinner />
              {ad.status === "queued" ? "Waiting to start" : "Generating"}
            </div>
          ) : null}
          {ad.status === "failed" ? (
            <Alert variant="destructive">
              <AlertTitle>Generation failed</AlertTitle>
              <AlertDescription>
                <p data-testid="ad-error">{ad.error}</p>
                {ad.mine ? (
                  <Button
                    className="mt-3"
                    variant="outline"
                    data-testid="ad-retry"
                    disabled={pending || !composer.ready}
                    onClick={() =>
                      act(async () => {
                        await retryAd({ data: { id: ad.id } });
                        await router.invalidate();
                      })
                    }
                  >
                    Retry
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Actor</dt>
            <dd className="flex items-center gap-3">
              {ad.portraitUrl && !ad.actorRemoved ? (
                <img
                  src={ad.portraitUrl}
                  alt=""
                  className="size-10 rounded-full border border-border object-cover"
                />
              ) : null}
              <span
                data-testid="ad-actor"
                className={ad.actorRemoved ? "text-muted-foreground" : ""}
              >
                {ad.actorRemoved ? "Actor removed" : ad.actorName}
              </span>
            </dd>
            <dt className="text-muted-foreground">Voice</dt>
            <dd>{voiceLabel(ad.voice)}</dd>
            {ad.direction ? (
              <>
                <dt className="text-muted-foreground">Delivery</dt>
                <dd>{ad.direction}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Language</dt>
            <dd>
              {ad.language}
              {ad.language !== ad.scriptLanguage ? (
                <span className="text-muted-foreground">
                  {" "}
                  (from {ad.scriptLanguage})
                </span>
              ) : null}
            </dd>
            <dt className="text-muted-foreground">Aspect ratio</dt>
            <dd>{ad.aspectRatio}</dd>
            {ad.batch ? (
              <>
                <dt className="text-muted-foreground">Batch</dt>
                <dd>
                  <Link
                    to="/batches/$batchId"
                    params={{ batchId: ad.batch.id }}
                    className="hover:underline"
                  >
                    {ad.batch.title}
                  </Link>
                </dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Script</dt>
            <dd className="whitespace-pre-wrap">{ad.script}</dd>
            {ad.translatedScript ? (
              <>
                <dt className="text-muted-foreground">Spoken script</dt>
                <dd data-testid="ad-translated" className="whitespace-pre-wrap">
                  {ad.translatedScript}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      )}

      {renaming ? (
        <RenameDialog
          title={ad.title}
          onClose={() => setRenaming(false)}
          onSave={async (title) => {
            await renameAd({ data: { id: ad.id, title } });
            setRenaming(false);
            await router.invalidate();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete this ad?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setDeleting(false)}
          onConfirm={() =>
            act(async () => {
              await deleteAd({ data: { id: ad.id } });
              setDeleting(false);
              await navigate({ to: "/" });
            })
          }
        >
          Its video is deleted too.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

function RenameDialog({
  title,
  onClose,
  onSave,
}: {
  title: string;
  onClose: () => void;
  onSave: (title: string) => Promise<void>;
}) {
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!value.trim()) return;
            setSaving(true);
            try {
              await onSave(value.trim());
            } catch (cause) {
              toast.error(
                cause instanceof Error ? cause.message : "That didn't work.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename ad</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-title">Title</Label>
            <Input
              id="rename-title"
              maxLength={120}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="rename-save"
              disabled={saving || !value.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
