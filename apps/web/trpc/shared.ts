/** Base URL of the orchestrator/API tRPC server. */
export function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
}
