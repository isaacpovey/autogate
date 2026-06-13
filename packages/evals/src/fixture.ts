import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { pullRequestSchema, verdictStatusSchema } from '@autogate/contracts';

const memoryRecordSchema = z.object({
  id: z.string(),
  text: z.string(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])),
});

export const riskBandSchema = z.enum(['low', 'medium', 'high']);
export type RiskBand = z.infer<typeof riskBandSchema>;

/** Labels a fixture asserts about the resulting verdict. All optional — shallow by design. */
export const fixtureExpectSchema = z.object({
  status: verdictStatusSchema.optional(),
  riskBand: riskBandSchema.optional(),
  minFindings: z.number().optional(),
  maxFindings: z.number().optional(),
});
export type FixtureExpect = z.infer<typeof fixtureExpectSchema>;

/**
 * A labeled fixture PR for one agent. `agentResponse` is the canned structured
 * output the mock `AgentSdk` returns — it is validated against the agent's own
 * output schema when the agent runs, so a malformed fixture surfaces as a failed
 * eval rather than a silent pass.
 */
export const fixtureSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  pr: pullRequestSchema,
  files: z.record(z.string()).optional(),
  memory: z
    .object({
      code_knowledge: z.array(memoryRecordSchema).optional(),
      decisions: z.array(memoryRecordSchema).optional(),
      patterns: z.array(memoryRecordSchema).optional(),
    })
    .optional(),
  agentResponse: z.unknown(),
  expect: fixtureExpectSchema.optional(),
});
export type Fixture = z.infer<typeof fixtureSchema>;

const parseFixtureFile = ({ path }: { path: string }): Fixture =>
  fixtureSchema.parse(JSON.parse(readFileSync(path, 'utf8')));

/** Load and validate every `*.json` fixture in an agent's evals directory. */
export const loadFixtures = ({ evalsDir }: { evalsDir: string }): Fixture[] => {
  if (!existsSync(evalsDir)) {
    return [];
  }
  return readdirSync(evalsDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => parseFixtureFile({ path: join(evalsDir, file) }));
};

/** Resolve a single fixture by filename stem or by its `name` field. */
export const loadFixture = ({ evalsDir, name }: { evalsDir: string; name: string }): Fixture => {
  const direct = join(evalsDir, `${name}.json`);
  if (existsSync(direct)) {
    return parseFixtureFile({ path: direct });
  }
  const match = loadFixtures({ evalsDir }).find((fixture) => fixture.name === name);
  if (match === undefined) {
    throw new Error(`No fixture "${name}" found in ${evalsDir}`);
  }
  return match;
};
