import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/client/components/ui/toggle-group";
import { formatDate } from "@/client/lib/format";
import { STATUSES } from "@/shared/options";
import { getAdsPage } from "@/serverFunctions/ads";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/")({
  validateSearch: z.object({ everyone: z.boolean().optional() }),
  loaderDeps: ({ search }) => ({ everyone: search.everyone ?? false }),
  loader: ({ deps }) => getAdsPage({ data: { everyone: deps.everyone } }),
  head: () => ({ meta: [{ title: "Ads · Talking Video Ads" }] }),
  component: AdsPage,
});

type SortKey = "title" | "createdAt" | "status";

function AdsPage() {
  const { admin, ads } = Route.useLoaderData();
  const { everyone = false } = Route.useSearch();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [actor, setActor] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "createdAt",
    desc: true,
  });
  const [page, setPage] = useState(0);

  const actorItems = useMemo(
    () => [
      { value: "all", label: "All actors" },
      ...[...new Set(ads.map((ad) => ad.actorName))]
        .sort()
        .map((name) => ({ value: name, label: name })),
    ],
    [ads],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = ads.filter(
      (ad) =>
        (status === "all" || ad.status === status) &&
        (actor === "all" || ad.actorName === actor) &&
        (!q ||
          ad.title.toLowerCase().includes(q) ||
          (ad.batchTitle ?? "").toLowerCase().includes(q)),
    );
    const dir = sort.desc ? -1 : 1;
    return filtered.sort(
      (a, b) =>
        a[sort.key].localeCompare(b[sort.key]) * dir ||
        a.id.localeCompare(b.id),
    );
  }, [ads, query, status, actor, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const filtering = query !== "" || status !== "all" || actor !== "all";

  function sortBy(key: SortKey) {
    setPage(0);
    setSort((s) =>
      s.key === key
        ? { key, desc: !s.desc }
        : { key, desc: key === "createdAt" },
    );
  }

  function SortHeader({ label, sortKey }: { label: string; sortKey: SortKey }) {
    const active = sort.key === sortKey;
    const Icon = sort.desc ? ArrowDown : ArrowUp;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2.5"
        onClick={() => sortBy(sortKey)}
      >
        {label}
        {active ? <Icon aria-hidden /> : null}
      </Button>
    );
  }

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Ads"
        actions={
          <>
            <Button variant="outline" render={<Link to="/batches/new" />}>
              New batch
            </Button>
            <Button render={<Link to="/ads/new" />}>New ad</Button>
          </>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            data-testid="ads-search"
            placeholder="Search titles"
            aria-label="Search titles"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className="min-w-40 flex-1"
          />
          <ChoiceSelect
            testId="ads-status-filter"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
            items={[{ value: "all", label: "All statuses" }, ...STATUSES]}
            className="w-36"
          />
          <ChoiceSelect
            testId="ads-actor-filter"
            value={actor}
            onChange={(v) => {
              setActor(v);
              setPage(0);
            }}
            items={actorItems}
            className="w-36"
          />
          {admin ? (
            <ToggleGroup
              data-testid="ads-scope"
              variant="outline"
              value={[everyone ? "everyone" : "mine"]}
              onValueChange={(next) => {
                if (!next[0]) return;
                setPage(0);
                void navigate({
                  to: "/",
                  search: next[0] === "everyone" ? { everyone: true } : {},
                });
              }}
            >
              <ToggleGroupItem value="mine">Mine</ToggleGroupItem>
              <ToggleGroupItem value="everyone">Everyone</ToggleGroupItem>
            </ToggleGroup>
          ) : null}
        </div>

        {ads.length === 0 ? (
          <EmptyState
            title="No ads yet"
            description="Write a script and pick an actor to make your first one."
            action={<Button render={<Link to="/ads/new" />}>New ad</Button>}
          />
        ) : (
          <TableCard>
            <Table data-testid="ads-table">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortHeader label="Title" sortKey="title" />
                  </TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Ratio</TableHead>
                  <TableHead>
                    <SortHeader label="Status" sortKey="status" />
                  </TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>
                    <SortHeader label="Created" sortKey="createdAt" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((ad) => (
                  <TableRow key={ad.id} data-testid="ad-row" data-ad-id={ad.id}>
                    <TableCell className="max-w-64">
                      <Link
                        to="/ads/$adId"
                        params={{ adId: ad.id }}
                        className="block truncate font-medium hover:underline"
                      >
                        {ad.title}
                      </Link>
                      {ad.ownerEmail ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {ad.ownerEmail}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell
                      className={ad.actorRemoved ? "text-muted-foreground" : ""}
                    >
                      {ad.actorName}
                    </TableCell>
                    <TableCell>{ad.language}</TableCell>
                    <TableCell>{ad.aspectRatio}</TableCell>
                    <TableCell>
                      <StatusBadge status={ad.status} />
                    </TableCell>
                    <TableCell className="max-w-40 truncate">
                      {ad.batchId ? (
                        <Link
                          to="/batches/$batchId"
                          params={{ batchId: ad.batchId }}
                          className="hover:underline"
                        >
                          {ad.batchTitle}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(ad.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {shown.length === 0 ? (
              <EmptyState
                kind="filtered"
                variant="plain"
                size="sm"
                title="No ads match"
                description={
                  filtering
                    ? "Clear the search or filters to see more."
                    : undefined
                }
              />
            ) : null}
          </TableCard>
        )}

        {rows.length > PAGE_SIZE ? (
          <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <span data-testid="ads-page">
              Page {current + 1} of {pages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              data-testid="ads-next"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
