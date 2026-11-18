import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdForm, EMPTY_AD } from "@/client/components/AdForm";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { GenerationOff } from "@/client/components/GenerationOff";
import { PageHeader } from "@/client/components/PageHeader";
import { createAd, getComposer } from "@/serverFunctions/ads";

export const Route = createFileRoute("/ads/new")({
  loader: () => getComposer(),
  head: () => ({ meta: [{ title: "New ad · Talking Video Ads" }] }),
  component: NewAd,
});

function NewAd() {
  const { actors, ready } = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="New ad"
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
      <AdForm
        initial={EMPTY_AD}
        actors={actors}
        ready={ready}
        onSubmit={async (values, generate) => {
          const ad = await createAd({ data: { ...values, generate } });
          await navigate({ to: "/ads/$adId", params: { adId: ad.id } });
        }}
      />
    </AppShell>
  );
}
