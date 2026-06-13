import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { z } from 'zod';
import { policySchema, pullRequestSchema, runDecisionSchema } from '@autogate/contracts';

const memoryRecordSchema = z.object({
  id: z.string(),
  text: z.string(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

const memorySeedSchema = z.object({
  code_knowledge: z.array(memoryRecordSchema).optional(),
  decisions: z.array(memoryRecordSchema).optional(),
  patterns: z.array(memoryRecordSchema).optional(),
});

/** Ground-truth label for one orchestrator outcome: its `Decision` and whether it should escalate. */
export const e2eExpectSchema = z.object({
  decision: runDecisionSchema,
  escalate: z.boolean(),
});
export type E2eExpect = z.infer<typeof e2eExpectSchema>;

/**
 * The trust-loop block. The named agent is run twice — once with the precedent
 * absent from memory and once with it seeded into the `decisions` collection —
 * so the eval can demonstrate precedent **retrieval** flipping the verdict. Each
 * condition carries its own canned agent response and ground-truth expectation.
 */
const trustLoopSchema = z.object({
  agentId: z.string(),
  /** Query text the precedent-aware agent runs against the `decisions` collection. */
  query: z.string(),
  /** The prior human override, seeded only in the with-precedent condition. */
  precedent: memoryRecordSchema,
  withoutPrecedent: z.object({ response: z.unknown(), expect: e2eExpectSchema }),
  withPrecedent: z.object({ response: z.unknown(), expect: e2eExpectSchema }),
});
export type TrustLoop = z.infer<typeof trustLoopSchema>;

/**
 * A labeled end-to-end fixture: a PR plus the canned structured output each L2
 * agent should return, replayed through the orchestrator against all mocks with
 * the gate forced green. `expect` is the ground-truth `Decision`; `agents` maps
 * agent id → its canned output (validated against that agent's own schema when
 * it runs). `trustLoop`, when present, drives the precedent-retrieval demo.
 */
export const e2eFixtureSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    pr: pullRequestSchema,
    files: z.record(z.string(), z.string()).optional(),
    memory: memorySeedSchema.optional(),
    policy: policySchema.optional(),
    sensitivePaths: z.array(z.string()).optional(),
    requiredChecks: z.union([z.literal('all'), z.array(z.string())]).optional(),
    agents: z.record(z.string(), z.unknown()).default({}),
    expect: e2eExpectSchema.optional(),
    trustLoop: trustLoopSchema.optional(),
  })
  .refine((fixture) => fixture.expect !== undefined || fixture.trustLoop !== undefined, {
    message: 'e2e fixture needs either `expect` (standard) or `trustLoop` (precedent demo)',
  });
export type E2eFixture = z.infer<typeof e2eFixtureSchema>;

const parse = ({ path }: { path: string }): E2eFixture =>
  e2eFixtureSchema.parse(JSON.parse(readFileSync(path, 'utf8')));

/** The bundled e2e fixture directory (`packages/evals/e2e`). */
export const e2eFixturesDir = fileURLToPath(new URL('../e2e/', import.meta.url));

/** Load and validate every `*.json` e2e fixture, sorted by filename. */
export const loadE2eFixtures = ({ dir = e2eFixturesDir }: { dir?: string } = {}): E2eFixture[] => {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => parse({ path: join(dir, file) }));
};
