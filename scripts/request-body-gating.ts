// Request-body gating for the dev/e2e static server: `new Request` throws
// when a GET/HEAD request carries a body, so bodies are only forwarded for
// methods that permit one (review M4, round 2). Pure and unit-tested.
// Generic so callers keep their inferred body type (Buffer etc.) for
// RequestInit.
//
// This helper is used by scripts/serve-static.ts ONLY. lambda/auth/index.ts
// keeps an inline copy of METHODS_WITH_BODY (no cross-import — the esbuild
// bundle must stay self-contained) — the two MUST stay in sync.

export const METHODS_WITH_BODY: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function bodyForMethod<T>(method: string | undefined, body: T | undefined): T | undefined {
  return method && METHODS_WITH_BODY.has(method) ? body : undefined;
}
