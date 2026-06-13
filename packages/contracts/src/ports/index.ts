import { z } from 'zod';
import type {
  CheckLayer,
  PullRequest,
  RepoConfig,
  Verdict,
} from '../schemas/domain.js';
import type { OverrideAction, RunStatus } from '../schemas/dashboard.js';


export type RepoFileEntry = {
  path: string;
  size: number;
};

export type RepoGrepMatch = {
  file: string;
  line: number;
  text: string;
};

export type RepoAccess = {
  read: (args: { path: string }) => Promise<string>;
  grep: (args: { pattern: string; include?: string[] }) => Promise<RepoGrepMatch[]>;
  list: (args: { dir: string }) => Promise<RepoFileEntry[]>;
};

export type MemoryCollection = 'code_knowledge' | 'decisions' | 'patterns';

export type MemoryRecord = {
  id: string;
  text: string;
  metadata: Record<string, string | number | boolean>;
};

export type MemoryClient = {
  query: (args: {
    collection: MemoryCollection;
    text: string;
    limit?: number;
  }) => Promise<MemoryRecord[]>;
  upsert: (args: {
    collection: MemoryCollection;
    records: MemoryRecord[];
  }) => Promise<void>;
};

export type MonitoringErrorEvent = {
  id: string;
  message: string;
  service: string;
  at: string;
  correlatedToChange: boolean;
};

export type MonitoringClient = {
  errorsSince: (args: {
    deploy: string;
    change: string;
  }) => Promise<MonitoringErrorEvent[]>;
};

export type RunContext = {
  pr: PullRequest;
  repo: RepoAccess;
  memory: MemoryClient;
  datadog?: MonitoringClient;
};

export type CheckSource = {
  id: string;
  layer: CheckLayer;
  appliesTo: (ctx: RunContext) => boolean;
  run: (ctx: RunContext) => Promise<Verdict>;
};

export type CheckRun = {
  name: string;
  conclusion: string;
  url?: string;
};

export type AwaitAllChecksResult = {
  allPassed: boolean;
  checks: CheckRun[];
};

export type PostStatusArgs = {
  pr: PullRequest;
  state: 'pending' | 'success' | 'failure';
  description: string;
};

export type MergeResult = {
  merged: boolean;
  sha: string;
};

export type VcsProvider = {
  getPR: (args: { repo: string; number: number }) => Promise<PullRequest>;
  getDiff: (args: { pr: PullRequest }) => Promise<string>;
  listCheckRuns: (args: { pr: PullRequest }) => Promise<CheckRun[]>;
  awaitAllChecks: (args: {
    pr: PullRequest;
    required: 'all' | string[];
  }) => Promise<AwaitAllChecksResult>;
  postStatus: (args: PostStatusArgs) => Promise<void>;
  postBrief: (args: { pr: PullRequest; brief: string }) => Promise<void>;
  merge: (args: { pr: PullRequest }) => Promise<MergeResult>;
};

export type SandboxCheckout = {
  ref: string;
  access: RepoAccess;
};

export type SandboxRunner = {
  clone: (args: { repo: string; ref: string; config: RepoConfig }) => Promise<SandboxCheckout>;
  teardown: (args: { checkout: SandboxCheckout }) => Promise<void>;
};

export type AgentRunArgs<TOutput> = {
  instructions: string;
  tools: string[];
  outputSchema: z.ZodType<TOutput>;
  context: RunContext;
};

export type AgentSdk = {
  run: <TOutput>(args: AgentRunArgs<TOutput>) => Promise<TOutput>;
};

export type StoredRun = {
  runId: string;
  pr: PullRequest;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
};

export type StoredVerdict = Verdict & {
  runId: string;
  layer: CheckLayer;
  durationMs: number;
};

export type StoredEscalation = {
  runId: string;
  brief: string;
  riskScore: number;
  createdAt: string;
};

export type StoredOverride = {
  runId: string;
  action: OverrideAction;
  reason: string;
  createdAt: string;
};

export type Store = {
  runs: {
    save: (args: { run: StoredRun }) => Promise<void>;
    get: (args: { runId: string }) => Promise<StoredRun | undefined>;
    list: (args: { repo?: string; limit?: number }) => Promise<StoredRun[]>;
  };
  verdicts: {
    save: (args: { verdict: StoredVerdict }) => Promise<void>;
    listForRun: (args: { runId: string }) => Promise<StoredVerdict[]>;
  };
  escalations: {
    save: (args: { escalation: StoredEscalation }) => Promise<void>;
    get: (args: { runId: string }) => Promise<StoredEscalation | undefined>;
  };
  overrides: {
    save: (args: { override: StoredOverride }) => Promise<void>;
    listForRun: (args: { runId: string }) => Promise<StoredOverride[]>;
  };
};

export type QueueJob<TPayload> = {
  id: string;
  payload: TPayload;
  attempts: number;
};

export type Queue<TPayload> = {
  enqueue: (args: { id: string; payload: TPayload }) => Promise<void>;
  claim: () => Promise<QueueJob<TPayload> | undefined>;
  complete: (args: { id: string }) => Promise<void>;
};
