// Single import surface for the contract types used across the dashboard.
// Runtime data still flows only through the tRPC AppRouter; these are the
// shared shapes the router's procedures resolve to.
export type {
  RunSummary,
  RunDetail,
  RunStatus,
  RunDecision,
  CheckResult,
  TrustMetrics,
  RepoSummary,
  OverrideAction,
  OverrideRequest,
  Verdict,
  VerdictStatus,
  CheckLayer,
  Finding,
  Severity,
} from "@autogate/contracts";
