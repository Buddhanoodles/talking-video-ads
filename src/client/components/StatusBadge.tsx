import { Badge } from "@/client/components/ui/badge";
import { statusLabel } from "@/shared/options";

const VARIANT = {
  draft: "outline",
  queued: "secondary",
  processing: "soft",
  ready: "success",
  failed: "destructive",
} as const;

export function StatusBadge({
  status,
  testId,
}: {
  status: string;
  testId?: string;
}) {
  return (
    <Badge
      variant={VARIANT[status as keyof typeof VARIANT] ?? "outline"}
      data-testid={testId}
    >
      {statusLabel(status)}
    </Badge>
  );
}
