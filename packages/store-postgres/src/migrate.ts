import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const statements = [
  sql`CREATE TABLE IF NOT EXISTS runs (
    run_id text PRIMARY KEY,
    pr jsonb NOT NULL,
    status text NOT NULL,
    repo text NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL
  )`,
  sql`CREATE TABLE IF NOT EXISTS verdicts (
    run_id text NOT NULL,
    source_id text NOT NULL,
    status text NOT NULL,
    confidence double precision NOT NULL,
    risk_contribution double precision NOT NULL,
    summary text NOT NULL,
    findings jsonb NOT NULL,
    layer text NOT NULL,
    duration_ms integer NOT NULL,
    PRIMARY KEY (run_id, source_id)
  )`,
  sql`CREATE TABLE IF NOT EXISTS escalations (
    run_id text PRIMARY KEY,
    brief text NOT NULL,
    risk_score double precision NOT NULL,
    created_at text NOT NULL
  )`,
  sql`CREATE TABLE IF NOT EXISTS overrides (
    id text PRIMARY KEY,
    run_id text NOT NULL,
    action text NOT NULL,
    reason text NOT NULL,
    created_at text NOT NULL
  )`,
  sql`CREATE TABLE IF NOT EXISTS jobs (
    id text PRIMARY KEY,
    payload jsonb NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    claimed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
];

export const runMigrations = async ({
  connectionString,
}: {
  connectionString: string;
}): Promise<void> => {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  await statements.reduce(
    (chain, statement) => chain.then(() => db.execute(statement)).then(() => undefined),
    Promise.resolve(),
  );
  await client.end();
};
