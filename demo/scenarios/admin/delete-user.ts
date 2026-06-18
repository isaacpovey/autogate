import type { IncomingMessage, ServerResponse } from "node:http";

interface UserStore {
  delete: (userId: string) => Promise<boolean>;
}

const parseUserId = (req: IncomingMessage): string | undefined => {
  const url = new URL(req.url ?? "", "http://localhost");
  const id = url.searchParams.get("id");
  return id ?? undefined;
};

const sendJson =
  (res: ServerResponse) =>
  (status: number, body: Record<string, unknown>): void => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

// DELETE /admin/users?id=<userId>
// Permanently removes a user and all associated records from the store.
// Used by the internal admin console to clean up accounts on request.
export const deleteUser =
  (deps: { store: UserStore }) =>
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const respond = sendJson(res);
    const userId = parseUserId(req);

    if (userId === undefined) {
      respond(400, { error: "missing user id" });
      return;
    }

    const removed = await deps.store.delete(userId);

    if (!removed) {
      respond(404, { error: "user not found" });
      return;
    }

    respond(200, { deleted: userId });
  };
