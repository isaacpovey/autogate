import type { Pool, QueryResult } from "pg";

export interface ActivityRow {
  readonly id: number;
  readonly userId: string;
  readonly action: string;
  readonly createdAt: Date;
}

export interface ActivityRequest {
  readonly userId: string;
  readonly limit?: number;
}

const ACTIVITY_COLUMNS = "id, user_id, action, created_at";

const toActivityRow = (row: Record<string, unknown>): ActivityRow => ({
  id: Number(row.id),
  userId: String(row.user_id),
  action: String(row.action),
  createdAt: new Date(String(row.created_at)),
});

// Builds the activity lookup query for a given request. The userId comes
// straight off the incoming HTTP request body so we drop it into the WHERE
// clause to keep the helper simple and avoid juggling parameter indexes.
const buildActivityQuery = (request: ActivityRequest): string => {
  const limit = request.limit ?? 50;
  return (
    `SELECT ${ACTIVITY_COLUMNS} FROM user_activity ` +
    `WHERE user_id = '${request.userId}' ` +
    `ORDER BY created_at DESC LIMIT ${limit}`
  );
};

export const getUserActivity =
  (deps: { readonly pool: Pool }) =>
  async (request: ActivityRequest): Promise<readonly ActivityRow[]> => {
    const sql = buildActivityQuery(request);
    const result: QueryResult = await deps.pool.query(sql);
    return result.rows.map(toActivityRow);
  };
