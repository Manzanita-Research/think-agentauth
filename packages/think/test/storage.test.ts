import { describe, expect, it } from "vitest";
import { createThinkSqlStorage, type ThinkSql } from "../src/storage";

describe("createThinkSqlStorage", () => {
  it("round-trips host, agent connection, and provider config records", async () => {
    const storage = createThinkSqlStorage(createMemorySql());

    await storage.setHostIdentity({ id: "host_1" });
    await storage.setAgentConnection("agt_1", { id: "agt_1" });
    await storage.setProviderConfig("http://localhost:3000", { issuer: "http://localhost:3000" });

    expect(await storage.getHostIdentity()).toEqual({ id: "host_1" });
    expect(await storage.getAgentConnection("agt_1")).toEqual({ id: "agt_1" });
    expect(await storage.listAgentConnections()).toEqual([{ id: "agt_1" }]);
    expect(await storage.getProviderConfig("http://localhost:3000")).toEqual({
      issuer: "http://localhost:3000",
    });
    expect(await storage.listProviderConfigs()).toEqual([{ issuer: "http://localhost:3000" }]);

    await storage.deleteAgentConnection("agt_1");
    expect(await storage.getAgentConnection("agt_1")).toBeNull();
  });
});

function createMemorySql(): ThinkSql {
  const rows = new Map<string, string>();

  return {
    exec(query: string, ...bindings: unknown[]) {
      if (query.startsWith("CREATE TABLE")) {
        return [];
      }

      if (query.startsWith("SELECT value") && query.includes("WHERE key = ?")) {
        const value = rows.get(String(bindings[0]));
        return value ? [{ value }] : [];
      }

      if (query.startsWith("SELECT value") && query.includes("WHERE key LIKE ?")) {
        const prefix = String(bindings[0]).replace("%", "");
        return [...rows.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, value]) => ({ value }));
      }

      if (query.startsWith("INSERT OR REPLACE")) {
        rows.set(String(bindings[0]), String(bindings[1]));
        return [];
      }

      if (query.startsWith("DELETE")) {
        rows.delete(String(bindings[0]));
        return [];
      }

      throw new Error(`Unexpected SQL: ${query}`);
    },
  };
}
