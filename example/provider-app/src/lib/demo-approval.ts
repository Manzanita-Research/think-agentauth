import { database, ensureDatabase } from "./database";

export async function resolveDemoApproval(input: {
  agentId: string;
  action: "approve" | "deny";
}) {
  await ensureDatabase();

  const now = new Date().toISOString();
  const agent = await database
    .prepare("SELECT id, hostId FROM agent WHERE id = ?")
    .bind(input.agentId)
    .first<{ id: string; hostId: string }>();

  if (!agent) {
    return { ok: false, status: 404, message: "Agent not found" };
  }

  if (input.action === "deny") {
    await database.batch([
      database
        .prepare("UPDATE agent SET status = 'revoked', updatedAt = ? WHERE id = ?")
        .bind(now, input.agentId),
      database
        .prepare(
          "UPDATE agentCapabilityGrant SET status = 'denied', updatedAt = ? WHERE agentId = ? AND status = 'pending'",
        )
        .bind(now, input.agentId),
      database
        .prepare(
          "UPDATE approvalRequest SET status = 'denied', updatedAt = ? WHERE agentId = ? AND status = 'pending'",
        )
        .bind(now, input.agentId),
    ]);
    return { ok: true, status: 200, result: { status: "denied", agentId: input.agentId } };
  }

  await database.batch([
    database
      .prepare(
        "UPDATE agentHost SET status = 'active', activatedAt = COALESCE(activatedAt, ?), updatedAt = ? WHERE id = ?",
      )
      .bind(now, now, agent.hostId),
    database
      .prepare(
        "UPDATE agent SET status = 'active', activatedAt = COALESCE(activatedAt, ?), updatedAt = ? WHERE id = ?",
      )
      .bind(now, now, input.agentId),
    database
      .prepare(
        "UPDATE agentCapabilityGrant SET status = 'active', updatedAt = ? WHERE agentId = ? AND status = 'pending'",
      )
      .bind(now, input.agentId),
    database
      .prepare(
        "UPDATE approvalRequest SET status = 'approved', updatedAt = ? WHERE agentId = ? AND status = 'pending'",
      )
      .bind(now, input.agentId),
  ]);

  return { ok: true, status: 200, result: { status: "approved", agentId: input.agentId } };
}
