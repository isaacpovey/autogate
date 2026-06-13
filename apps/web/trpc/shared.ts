/**
 * Base URL of the orchestrator/API tRPC server.
 *
 * On the server (RSC prefetch) we prefer an internal, in-cluster URL so SSR
 * never loops back out through the public TLS endpoint. In the browser only
 * the build-time-inlined `NEXT_PUBLIC_API_URL` is available, which points at
 * the public `/api` path served by the reverse proxy.
 */
export function getApiUrl() {
  const isServer = typeof window === "undefined";
  const internal = process.env.INTERNAL_API_URL;
  if (isServer && internal) return internal;
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
}
