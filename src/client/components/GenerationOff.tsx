import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/client/components/ui/alert";

/** Shown where videos are made while the Gateway holds no Replicate key. */
export function GenerationOff() {
  return (
    <Alert data-testid="generation-off">
      <AlertTitle>Video generation is off</AlertTitle>
      <AlertDescription>
        An admin turns it on by adding a Replicate key to the Gateway.
      </AlertDescription>
    </Alert>
  );
}
