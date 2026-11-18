import { Link } from "@tanstack/react-router";

const LINK =
  "text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";

/** The app's pages, in the AppShell bar. */
export function AppNav() {
  return (
    <nav className="flex items-center gap-4">
      <Link to="/" className={LINK} activeOptions={{ exact: true }}>
        Ads
      </Link>
      <Link to="/actors" className={LINK}>
        Actors
      </Link>
      <Link to="/batches/new" className={LINK}>
        Batch
      </Link>
    </nav>
  );
}
