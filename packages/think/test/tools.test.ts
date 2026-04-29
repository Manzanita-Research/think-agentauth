import { describe, expect, it, vi } from "vitest";
import { createAgentAuthTools } from "../src/tools";

describe("createAgentAuthTools", () => {
  it("returns the expected prefixed tool names", () => {
    const tools = createAgentAuthTools({ client: {} });

    expect(Object.keys(tools)).toEqual([
      "agentauth_list_providers",
      "agentauth_search_providers",
      "agentauth_discover_provider",
      "agentauth_list_capabilities",
      "agentauth_describe_capability",
      "agentauth_connect_agent",
      "agentauth_agent_status",
      "agentauth_request_capability",
      "agentauth_disconnect_agent",
      "agentauth_reactivate_agent",
      "agentauth_execute_capability",
    ]);
  });

  it("delegates tool execution to the wrapped client", async () => {
    const listCapabilities = vi.fn(async (input) => ({ capabilities: [], input }));
    const tools = createAgentAuthTools({
      client: { listCapabilities },
    });

    const output = await executeTool(tools.agentauth_list_capabilities, {
      provider: "http://localhost:3000",
      agent_id: "agt_123",
      query: "notes",
    });

    expect(listCapabilities).toHaveBeenCalledWith({
      provider: "http://localhost:3000",
      agent_id: "agt_123",
      agentId: "agt_123",
      query: "notes",
    });
    expect(output).toEqual({
      capabilities: [],
      input: {
        provider: "http://localhost:3000",
        agent_id: "agt_123",
        agentId: "agt_123",
        query: "notes",
      },
    });
  });

  it("normalizes pending approval results", async () => {
    const connectAgent = vi.fn(async () => ({
      status: "pending",
      approval: {
        verification_uri: "http://localhost:3000/device/capabilities",
        user_code: "ABCD-1234",
      },
    }));
    const tools = createAgentAuthTools({ client: { connectAgent }, agentName: "Test Agent" });

    const output = await executeTool(tools.agentauth_connect_agent, {
      provider: "http://localhost:3000",
      capabilities: ["create_note"],
      mode: "delegated",
    });

    expect(output).toMatchObject({
      status: "pending",
      approval: {
        status: "pending_approval",
        verificationUri: "http://localhost:3000/device/capabilities",
        userCode: "ABCD-1234",
      },
    });
  });

  it("retries capability execution with a stored connection when the model uses a stale agent id", async () => {
    const executeCapability = vi
      .fn()
      .mockRejectedValueOnce(new Error("No local connection for agent agent_old."))
      .mockResolvedValueOnce({ data: { id: "note_2" } });
    const tools = createAgentAuthTools({
      client: { executeCapability },
      storage: {
        getHostIdentity: vi.fn(),
        setHostIdentity: vi.fn(),
        deleteHostIdentity: vi.fn(),
        getAgentConnection: vi.fn(),
        setAgentConnection: vi.fn(),
        deleteAgentConnection: vi.fn(),
        listAgentConnections: vi.fn(async () => [{ id: "agent_current" }]),
        getProviderConfig: vi.fn(),
        setProviderConfig: vi.fn(),
        listProviderConfigs: vi.fn(),
      },
    });

    const output = await executeTool(tools.agentauth_execute_capability, {
      agent_id: "agent_old",
      capability: "create_note",
      arguments: { title: "Hello AgentAuth" },
    });

    expect(executeCapability).toHaveBeenNthCalledWith(1, {
      agent_id: "agent_old",
      agentId: "agent_old",
      capability: "create_note",
      arguments: { title: "Hello AgentAuth" },
    });
    expect(executeCapability).toHaveBeenNthCalledWith(2, {
      agent_id: "agent_current",
      agentId: "agent_current",
      capability: "create_note",
      arguments: { title: "Hello AgentAuth" },
    });
    expect(output).toEqual({ data: { id: "note_2" } });
  });
});

async function executeTool(tool: unknown, input: unknown): Promise<unknown> {
  const execute = (tool as { execute?: (input: unknown) => Promise<unknown> }).execute;
  if (!execute) {
    throw new Error("Tool has no execute function");
  }
  return execute(input);
}
