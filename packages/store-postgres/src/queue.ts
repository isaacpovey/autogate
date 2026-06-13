import type { Queue, QueueJob } from '@autogate/contracts';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { jobs } from './schema.js';

type ClaimedRow<TPayload> = {
  id: string;
  payload: TPayload;
  attempts: number;
} & Record<string, unknown>;

export const createQueue = <TPayload>({
  connectionString,
}: {
  connectionString: string;
}): Queue<TPayload> => {
  const client = postgres(connectionString);
  const db = drizzle(client);

  return {
    enqueue: async ({ id, payload }) => {
      await db
        .insert(jobs)
        .values({ id, payload, attempts: 0 })
        .onConflictDoNothing({ target: jobs.id });
    },
    claim: async () => {
      const rows = await db.execute<ClaimedRow<TPayload>>(sql`
        UPDATE ${jobs}
        SET attempts = attempts + 1, claimed_at = now()
        WHERE id = (
          SELECT id FROM ${jobs}
          WHERE claimed_at IS NULL
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING id, payload, attempts
      `);
      const row = rows[0];
      if (row === undefined) {
        return undefined;
      }
      const claimed: QueueJob<TPayload> = {
        id: row.id,
        payload: row.payload,
        attempts: row.attempts,
      };
      return claimed;
    },
    complete: async ({ id }) => {
      await db.execute(sql`DELETE FROM ${jobs} WHERE id = ${id}`);
    },
  };
};
