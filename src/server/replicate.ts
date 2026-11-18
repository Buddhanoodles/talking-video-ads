import { env } from "cloudflare:workers";
import { integrationFetch, integrationStatus } from "@every-app/sdk/server";

const API = "https://api.replicate.com/v1";

export class GenerationError extends Error {}

function replicate() {
  return integrationFetch({
    env,
    provider: "replicate",
    for: { background: true },
  });
}

/** Whether the Gateway holds a Replicate key for this app. */
export async function generationReady(): Promise<boolean> {
  try {
    const status = await integrationStatus({
      env,
      provider: "replicate",
      for: { background: true },
    });
    return status.ready;
  } catch {
    return false;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await replicate()(API + path, init);
  if (response.headers.get("x-everyapp-error")) {
    throw new GenerationError("Video generation isn't set up.");
  }
  const body = (await response.json().catch(() => null)) as
    | (T & { detail?: string })
    | null;
  if (!response.ok || !body) {
    throw new GenerationError(
      body?.detail ?? `Replicate answered ${response.status}.`,
    );
  }
  return body;
}

export interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: string | null;
}

export function createPrediction(
  model: string,
  input: Record<string, unknown>,
  webhook: string,
): Promise<Prediction> {
  return call(`/models/${model}/predictions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input,
      webhook,
      webhook_events_filter: ["completed"],
    }),
  });
}

/**
 * A prediction's output file: from Replicate's file host, or inline when
 * Replicate returns it as a data URL.
 */
export async function downloadOutput(url: string): Promise<ArrayBuffer> {
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    if (comma < 0 || !url.slice(0, comma).endsWith(";base64")) {
      throw new GenerationError("The model returned an unreadable file.");
    }
    return Uint8Array.from(atob(url.slice(comma + 1)), (c) => c.charCodeAt(0))
      .buffer;
  }
  const target = new URL(url);
  const replicateHost =
    target.host === "replicate.delivery" ||
    target.host.endsWith(".replicate.delivery");
  if (target.protocol !== "https:" || !replicateHost) {
    throw new GenerationError(
      "The model returned an unexpected file location.",
    );
  }
  const response = await fetch(target);
  if (!response.ok)
    throw new GenerationError("The video couldn't be downloaded.");
  return response.arrayBuffer();
}
