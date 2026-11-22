/**
 * Fetch/error helpers shared by the dashboard panels.
 *
 * A panel has to tell an outage apart from an empty result, so fetchers throw a
 * typed error carrying the HTTP status. Falling through to `res.json()` like
 * the old fetchers did turns a 500 HTML page or a 429 body into a parse error
 * (or worse, into "no data"), which is exactly the dead end this module fixes.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message = `HTTP ${status}`) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type PanelFailureKind =
  | "offline"
  | "rate-limited"
  | "upstream"
  | "network"
  | "unknown";

export interface PanelFailure {
  kind: PanelFailureKind;
  status: number | null;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(res.status);
  return (await res.json()) as T;
}

/** Read an HTTP status from a typed error or a "… failed: 429" style message. */
function statusOf(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && status >= 400) return status;
  }
  if (error instanceof Error) {
    const match = error.message.match(/\b([45]\d{2})\b/);
    if (match) return Number(match[1]);
  }
  return null;
}

export function classifyFailure(error: unknown): PanelFailure {
  const status = statusOf(error);
  if (status === 429) return { kind: "rate-limited", status };
  if (status !== null && status >= 500) return { kind: "upstream", status };
  // fetch() rejects with a TypeError when the request never reached a server.
  if (error instanceof TypeError) return { kind: "network", status };
  return { kind: "unknown", status };
}

export function formatUpdatedAgo(updatedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (seconds < 60) return "updated just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `updated ${hours}h ago`;
  return `updated ${Math.floor(hours / 24)}d ago`;
}
