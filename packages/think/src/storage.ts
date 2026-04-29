import type { AgentAuthStorage } from "./types.js";

export type ThinkSqlCursor = {
  toArray?: () => unknown[];
  [Symbol.iterator]?: () => Iterator<unknown>;
};

export type ThinkSql = {
  exec: (query: string, ...bindings: unknown[]) => ThinkSqlCursor | unknown[];
};

type StoredRow = {
  key?: string;
  value?: string;
};

export function createThinkSqlStorage(sql: ThinkSql, namespace = "agentauth"): AgentAuthStorage {
  const tableName = `${namespace}_kv`;
  let initialized = false;

  async function ensureTable() {
    if (initialized) {
      return;
    }

    sql.exec(
      `CREATE TABLE IF NOT EXISTS ${tableName} (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
    );
    initialized = true;
  }

  async function getJson(key: string): Promise<unknown | null> {
    await ensureTable();
    const rows = rowsFromCursor(sql.exec(`SELECT value FROM ${tableName} WHERE key = ?`, key));
    const value = (rows[0] as StoredRow | undefined)?.value;
    return value ? JSON.parse(value) : null;
  }

  async function setJson(key: string, value: unknown): Promise<void> {
    await ensureTable();
    sql.exec(
      `INSERT OR REPLACE INTO ${tableName} (key, value, updated_at) VALUES (?, ?, ?)`,
      key,
      JSON.stringify(value),
      Date.now(),
    );
  }

  async function deleteJson(key: string): Promise<void> {
    await ensureTable();
    sql.exec(`DELETE FROM ${tableName} WHERE key = ?`, key);
  }

  async function listJson(prefix: string): Promise<unknown[]> {
    await ensureTable();
    const rows = rowsFromCursor(
      sql.exec(`SELECT value FROM ${tableName} WHERE key LIKE ? ORDER BY key`, `${prefix}%`),
    );

    return rows
      .map((row) => (row as StoredRow).value)
      .filter((value): value is string => typeof value === "string")
      .map((value) => JSON.parse(value));
  }

  return {
    getHostIdentity: () => getJson("host:identity"),
    setHostIdentity: (host) => setJson("host:identity", host),
    deleteHostIdentity: () => deleteJson("host:identity"),
    getAgentConnection: (agentId) => getJson(`agent:${agentId}`),
    setAgentConnection: (agentId, connection) => setJson(`agent:${agentId}`, connection),
    deleteAgentConnection: (agentId) => deleteJson(`agent:${agentId}`),
    listAgentConnections: () => listJson("agent:"),
    getProviderConfig: (issuer) => getJson(`provider:${issuer}`),
    setProviderConfig: (issuer, config) => setJson(`provider:${issuer}`, config),
    listProviderConfigs: () => listJson("provider:"),
  };
}

function rowsFromCursor(cursor: ThinkSqlCursor | unknown[]): unknown[] {
  if (Array.isArray(cursor)) {
    return cursor;
  }

  if (typeof cursor?.toArray === "function") {
    return cursor.toArray();
  }

  const iterator = cursor?.[Symbol.iterator];
  if (typeof iterator === "function") {
    const values: unknown[] = [];
    const iterable = iterator.call(cursor);
    let next = iterable.next();
    while (!next.done) {
      values.push(next.value);
      next = iterable.next();
    }
    return values;
  }

  return [];
}
