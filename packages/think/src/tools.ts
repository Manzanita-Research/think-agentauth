import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  callClientMethod,
  createAgentAuthClient,
  normalizeApproval,
  normalizeToolResult,
} from "./client.js";
import type {
  AgentAuthApprovalRequired,
  AgentAuthBaseToolName,
  AgentAuthCapabilityRequest,
  AgentAuthClientLike,
  AgentAuthThinkOptions,
} from "./types.js";

const capabilitySchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    constraints: z.record(z.string(), z.unknown()).optional(),
  }),
]);

const toolOrder: AgentAuthBaseToolName[] = [
  "list_providers",
  "search_providers",
  "discover_provider",
  "list_capabilities",
  "describe_capability",
  "connect_agent",
  "agent_status",
  "request_capability",
  "disconnect_agent",
  "reactivate_agent",
  "execute_capability",
];

export function createAgentAuthTools(options: AgentAuthThinkOptions = {}): ToolSet {
  const prefix = options.prefix ?? "agentauth_";
  const enabled = options.tools ?? {};
  let clientPromise: Promise<AgentAuthClientLike> | undefined;
  let lastApproval: AgentAuthApprovalRequired | undefined;

  const getClient = () => {
    clientPromise ??= createAgentAuthClient({
      ...options,
      approvalTimeoutMs: options.approvalTimeoutMs ?? 250,
      onApprovalRequired: async (approval) => {
        lastApproval = normalizeApproval(approval.raw);
        await options.onApprovalRequired?.(approval);
      },
    });
    return clientPromise;
  };

  const isEnabled = (name: AgentAuthBaseToolName) => enabled[name] !== false;
  const withPrefix = (name: AgentAuthBaseToolName) => `${prefix}${name}`;
  const tools: ToolSet = {};

  if (isEnabled("list_providers")) {
    tools[withPrefix("list_providers")] = tool({
      description: "List AgentAuth providers already known to this Think agent.",
      inputSchema: z.object({}),
      execute: async () => normalizeToolResult(await callClientMethod(await getClient(), ["listProviders", "list_providers"], [])),
    });
  }

  if (isEnabled("search_providers")) {
    tools[withPrefix("search_providers")] = tool({
      description: "Search an AgentAuth directory for providers by intent.",
      inputSchema: z.object({
        intent: z.string().describe("Natural-language description of the provider or capability needed."),
      }),
      execute: async ({ intent }) =>
        normalizeToolResult(
          await callClientMethod(await getClient(), ["searchProviders", "search_providers"], [
            { intent },
          ]).catch(async () =>
            callClientMethod(await getClient(), ["searchProviders", "search_providers"], [intent]),
          ),
        ),
    });
  }

  if (isEnabled("discover_provider")) {
    tools[withPrefix("discover_provider")] = tool({
      description: "Discover an AgentAuth provider from a service URL.",
      inputSchema: z.object({
        url: z.string().url().describe("Provider base URL or AgentAuth discovery URL."),
      }),
      execute: async ({ url }) =>
        normalizeToolResult(
          await callClientMethod(await getClient(), ["discoverProvider", "discover_provider"], [
            url,
          ]).catch(async () =>
            callClientMethod(await getClient(), ["discoverProvider", "discover_provider"], [{ url }]),
          ),
        ),
    });
  }

  if (isEnabled("list_capabilities")) {
    tools[withPrefix("list_capabilities")] = tool({
      description: "List capabilities offered by an AgentAuth provider.",
      inputSchema: z.object({
        provider: z.string().describe("Provider name or URL."),
        query: z.string().optional(),
        agent_id: z.string().optional(),
        limit: z.number().int().positive().optional(),
        cursor: z.string().optional(),
      }),
      execute: async (input) =>
        normalizeToolResult(
          await callClientMethod(await getClient(), ["listCapabilities", "list_capabilities"], [
            { ...input, agentId: input.agent_id },
          ]),
        ),
    });
  }

  if (isEnabled("describe_capability")) {
    tools[withPrefix("describe_capability")] = tool({
      description: "Get a capability's full AgentAuth input and output schema.",
      inputSchema: z.object({
        provider: z.string().describe("Provider name or URL."),
        name: z.string().describe("Capability name."),
        agent_id: z.string().optional(),
      }),
      execute: async (input) =>
        normalizeToolResult(
          await callClientMethod(await getClient(), ["describeCapability", "describe_capability"], [
            { ...input, agentId: input.agent_id },
          ]),
        ),
    });
  }

  if (isEnabled("connect_agent")) {
    tools[withPrefix("connect_agent")] = tool({
      description:
        "Register this Think agent with an AgentAuth provider and request initial capability grants.",
      inputSchema: z.object({
        provider: z.string().describe("Provider name or URL."),
        capabilities: z.array(capabilitySchema).optional(),
        mode: z.enum(["delegated", "autonomous"]).default("delegated"),
        name: z.string().optional(),
        reason: z.string().optional(),
        preferred_method: z.string().optional(),
        login_hint: z.string().optional(),
        binding_message: z.string().optional(),
        force_new: z.boolean().optional(),
      }),
      execute: async (input) => {
        const name = input.name ?? resolveAgentName(options);
        try {
          return normalizeToolResult(
            await callClientMethod(await getClient(), ["connectAgent", "connect_agent"], [
              {
                ...input,
                name,
                capabilities: input.capabilities as AgentAuthCapabilityRequest[] | undefined,
                preferredMethod: input.preferred_method,
                loginHint: input.login_hint,
                bindingMessage: input.binding_message,
                forceApproval: input.force_new,
              },
            ]),
          );
        } catch (error) {
          const pending = approvalTimeoutToResult(error, lastApproval);
          if (pending) {
            return pending;
          }
          throw error;
        }
      },
    });
  }

  if (isEnabled("agent_status")) {
    tools[withPrefix("agent_status")] = tool({
      description: "Check an AgentAuth agent's current state and capability grants.",
      inputSchema: z.object({
        agent_id: z.string(),
      }),
      execute: async ({ agent_id }) =>
        normalizeToolResult(await callAgentStatus(await getClient(), agent_id)),
    });
  }

  if (isEnabled("request_capability")) {
    tools[withPrefix("request_capability")] = tool({
      description: "Request additional AgentAuth capabilities for an existing agent.",
      inputSchema: z.object({
        agent_id: z.string(),
        capabilities: z.array(capabilitySchema),
        reason: z.string().optional(),
        preferred_method: z.string().optional(),
        login_hint: z.string().optional(),
        binding_message: z.string().optional(),
      }),
      execute: async (input) => {
        try {
          return normalizeToolResult(
            await callClientMethod(await getClient(), ["requestCapability", "request_capability"], [
              {
                ...input,
                agentId: input.agent_id,
                preferredMethod: input.preferred_method,
                loginHint: input.login_hint,
                bindingMessage: input.binding_message,
              },
            ]),
          );
        } catch (error) {
          const pending = approvalTimeoutToResult(error, lastApproval);
          if (pending) {
            return pending;
          }
          throw error;
        }
      },
    });
  }

  if (isEnabled("disconnect_agent")) {
    tools[withPrefix("disconnect_agent")] = tool({
      description: "Revoke and remove an AgentAuth agent connection.",
      inputSchema: z.object({
        agent_id: z.string(),
      }),
      execute: async ({ agent_id }) =>
        normalizeToolResult(await callAgentIdMethod(await getClient(), ["disconnectAgent", "disconnect_agent"], agent_id)),
    });
  }

  if (isEnabled("reactivate_agent")) {
    tools[withPrefix("reactivate_agent")] = tool({
      description: "Reactivate an expired AgentAuth agent connection.",
      inputSchema: z.object({
        agent_id: z.string(),
      }),
      execute: async ({ agent_id }) =>
        normalizeToolResult(await callAgentIdMethod(await getClient(), ["reactivateAgent", "reactivate_agent"], agent_id)),
    });
  }

  if (isEnabled("execute_capability")) {
    tools[withPrefix("execute_capability")] = tool({
      description: "Execute a granted AgentAuth capability.",
      inputSchema: z.object({
        agent_id: z.string(),
        capability: z.string(),
        arguments: z.record(z.string(), z.unknown()).optional(),
      }),
      execute: async (input) => {
        const client = await getClient();
        const executeWithAgent = (agentId: string) =>
          callClientMethod(client, ["executeCapability", "execute_capability"], [
            { ...input, agent_id: agentId, agentId },
          ]);

        try {
          return normalizeToolResult(await executeWithAgent(input.agent_id));
        } catch (error) {
          const fallbackAgentId = await resolveStoredAgentId(options.storage, input.agent_id);
          if (fallbackAgentId && isLocalConnectionMissing(error)) {
            return normalizeToolResult(await executeWithAgent(fallbackAgentId));
          }

          if (!isCapabilityGrantStale(error)) {
            throw error;
          }

          await callAgentStatus(client, input.agent_id).catch(() => null);

          return normalizeToolResult(
            await callClientMethod(client, ["executeCapability", "execute_capability"], [
              { ...input, agent_id: input.agent_id, agentId: input.agent_id },
            ]),
          );
        }
      },
    });
  }

  return orderTools(tools, prefix);
}

function resolveAgentName(options: AgentAuthThinkOptions): string {
  if (typeof options.agentName === "function") {
    return options.agentName({
      agentName: undefined,
      hostName: options.hostName,
      providerUrls: options.providerUrls,
    });
  }

  return options.agentName ?? "Think Agent";
}

async function resolveStoredAgentId(
  storage: AgentAuthThinkOptions["storage"],
  rejectedAgentId?: string,
): Promise<string | undefined> {
  const connections = await storage?.listAgentConnections().catch(() => []);
  if (!connections?.length) {
    return undefined;
  }

  const ids = connections
    .map(agentIdFromConnection)
    .filter((id): id is string => Boolean(id) && id !== rejectedAgentId);

  return ids.at(-1);
}

function agentIdFromConnection(connection: unknown): string | undefined {
  if (typeof connection === "string") {
    return connection;
  }

  if (!connection || typeof connection !== "object") {
    return undefined;
  }

  const record = connection as Record<string, unknown>;
  const candidate = record.id ?? record.agentId ?? record.agent_id;
  return typeof candidate === "string" ? candidate : undefined;
}

function approvalTimeoutToResult(
  error: unknown,
  approval: AgentAuthApprovalRequired | undefined,
): Record<string, unknown> | null {
  if (!approval || !isApprovalTimeout(error)) {
    return null;
  }

  return {
    status: "pending_approval",
    agent_id: agentIdFromApproval(approval),
    approval,
    message: "Approval is required before this AgentAuth connection can be used.",
  };
}

function isApprovalTimeout(error: unknown): boolean {
  const record = error as { code?: unknown; message?: unknown };
  return (
    record?.code === "approval_timeout" ||
    (typeof record?.message === "string" && record.message.toLowerCase().includes("approval timed out"))
  );
}

function isLocalConnectionMissing(error: unknown): boolean {
  const record = error as { code?: unknown; message?: unknown };
  return (
    record?.code === "local_connection_missing" ||
    (typeof record?.message === "string" && record.message.includes("No local connection"))
  );
}

function isCapabilityGrantStale(error: unknown): boolean {
  const record = error as { code?: unknown; message?: unknown };
  return (
    record?.code === "capability_not_granted" ||
    (typeof record?.message === "string" && record.message.includes("is not granted"))
  );
}

async function callAgentStatus(client: AgentAuthClientLike, agentId: string): Promise<unknown> {
  return callAgentIdMethod(client, ["agentStatus", "getAgentStatus", "agent_status"], agentId);
}

async function callAgentIdMethod(
  client: AgentAuthClientLike,
  names: readonly string[],
  agentId: string,
): Promise<unknown> {
  try {
    return await callClientMethod(client, names, [{ agentId, agent_id: agentId }]);
  } catch (error) {
    if (!isLikelySignatureMismatch(error)) {
      throw error;
    }
    return callClientMethod(client, names, [agentId]);
  }
}

function isLikelySignatureMismatch(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") {
    return false;
  }

  return (
    message.includes("No local connection") ||
    message.includes("[object Object]") ||
    message.includes("agent_id") ||
    message.includes("agentId")
  );
}

function agentIdFromApproval(approval: AgentAuthApprovalRequired): string | undefined {
  const url = approval.verificationUriComplete;
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).searchParams.get("agent_id") ?? undefined;
  } catch {
    return undefined;
  }
}

function orderTools(tools: ToolSet, prefix: string): ToolSet {
  const ordered: ToolSet = {};
  for (const name of toolOrder) {
    const key = `${prefix}${name}`;
    if (tools[key]) {
      ordered[key] = tools[key];
    }
  }
  return ordered;
}
