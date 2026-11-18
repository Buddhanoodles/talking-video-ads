import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Download, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { getBatch, retryBatch } from "@/serverFunctions/ads";

export const Route = createFileRoute("/batches/$batchId")({
  loader: ({ params }) => getBatch({ data: { id: params.batchId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Batch"} · Talking Video Ads` }],
  }),
  component: BatchPage,
});

const back = (
  <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
    ← Ads
  </Link>
);

function BatchPage() {
  const batch = Route.useLoaderData();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const counts = { ready: 0, failed: 0, pending: 0 };
  for (const v of batch?.variations ?? []) {
    if (v.status === "ready") counts.ready++;
    else if (v.status === "failed") counts.failed++;
    else counts.pending++;
  }

  useEffect(() => {
    if (!counts.pending) return;
    const timer = setInterval(() => void router.invalidate(), 3000);
    return () => clearInterval(timer);
  }, [counts.pending, router]);

  if (!batch) {
    return (
      <AppShell nav={<AppNav />}>
        <PageHeader title="Batch not found" backLink={back} />
        <EmptyState
          kind="filtered"
          title="This batch doesn't exist or isn't yours"
        />
      </AppShell>
    );
  }

  async function retry(adId?: string) {
    setPending(true);
    try {
      await retryBatch({ data: { id: batch!.id, adId } });
      await router.invalidate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "That didn't work.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={batch.title}
        backLink={back}
        description={
          <span data-testid="batch-counts">
            {counts.ready} ready · {counts.failed} failed · {counts.pending}{" "}
            pending
          </span>
        }
        actions={
          batch.mine && counts.failed > 0 ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => void retry()}
            >
              <RotateCcw aria-hidden />
              Retry failed
            </Button>
          ) : null
        }
      />
      <p className="text-sm text-muted-foreground">{batch.body}</p>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hook</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Video</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batch.variations.map((v) => (
              <TableRow
                key={v.id}
                data-testid="variation-row"
                data-status={v.status}
              >
                <TableCell className="max-w-72 whitespace-normal">
                  <Link
                    to="/ads/$adId"
                    params={{ adId: v.id }}
                    className="hover:underline"
                  >
                    {v.hook}
                  </Link>
                  {v.error ? (
                    <div className="text-xs text-destructive">{v.error}</div>
                  ) : null}
                </TableCell>
                <TableCell>{v.actorName}</TableCell>
                <TableCell>{v.language}</TableCell>
                <TableCell>
                  <StatusBadge status={v.status} />
                </TableCell>
                <TableCell className="text-right">
                  {v.hasVideo ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Download MP4"
                      data-testid="variation-download"
                      render={
                        <a href={`/files/ads/${v.id}?download=1`} download />
                      }
                    >
                      <Download />
                    </Button>
                  ) : v.status === "failed" && batch.mine ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Retry"
                      data-testid="variation-retry"
                      disabled={pending}
                      onClick={() => void retry(v.id)}
                    >
                      <RotateCcw />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </AppShell>
  );
}
