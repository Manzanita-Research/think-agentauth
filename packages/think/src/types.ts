import type { ToolSet } from "ai";

export type AgentAuthCapabilityRequest =
  | string
  | {
      name: string;
      constraints?: Record<string, unknown>;
    };

export type AgentAuthClientLike = {
  discoverProvider?: (url: string) => Promise<unknown>;
  discover_provider?: (input: { url: string }) => Promise<unknown>;
  listProviders?: () => Promise<unknown>;
  list_providers?: () => Promise<unknown>;
  searchProviders?: (intent: string) => Promise<unknown>;
  search_providers?: (input: { intent: string }) => Promise<unknown>;
  listCapabilities?: (input: {
    provider: string;
    query?: string;
    agentId?: string;
    agent_id?: string;
    limit?: number;
    cursor?: string;
  }) => Promise<unknown>;
  list_capabilities?: (input: Record<string, unknown>) => Promise<unknown>;
  describeCapability?: (input: {
    provider: string;
    name: string;
    agentId?: string;
    agent_id?: string;
  }) => Promise<unknown>;
  describe_capability?: (input: Record<string, unknown>) => Promise<unknown>;
  connectAgent?: (input: Record<string, unknown>) => Promise<unknown>;
  connect_agent?: (input: Record<string, unknown>) => Promise<unknown>;
  agentStatus?: (input: { agentId: string; agent_id?: string }) => Promise<unknown>;
  getAgentStatus?: (input: { agentId: string; agent_id?: string }) => Promise<unknown>;
  agent_status?: (input: { agent_id: string; agentId?: string }) => Promise<unknown>;
  requestCapability?: (input: Record<string, unknown>) => Promise<unknown>;
  request_capability?: (input: Record<string, unknown>) => Promise<unknown>;
  disconnectAgent?: (input: { agentId: string; agent_id?: string }) => Promise<unknown>;
  disconnect_agent?: (input: { agent_id: string; agentId?: string }) => Promise<unknown>;
  reactivateAgent?: (input: { agentId: string; agent_id?: string }) => Promise<unknown>;
  reactivate_agent?: (input: { agent_id: string; agentId?: string }) => Promise<unknown>;
  executeCapability?: (input: Record<string, unknown>) => Promise<unknown>;
  execute_capability?: (input: Record<string, unknown>) => Promise<unknown>;
};

export type AgentAuthStorage = {
  getHostIdentity(): Promise<unknown | null>;
  setHostIdentity(host: unknown): Promise<void>;
  deleteHostIdentity(): Promise<void>;
  getAgentConnection(agentId: string): Promise<unknown | null>;
  setAgentConnection(agentId: string, connection: unknown): Promise<void>;
  deleteAgentConnection(agentId: string): Promise<void>;
  listAgentConnections(): Promise<unknown[]>;
  getProviderConfig(issuer: string): Promise<unknown | null>;
  setProviderConfig(issuer: string, config: unknown): Promise<void>;
  listProviderConfigs(): Promise<unknown[]>;
};

export type AgentAuthThinkContext = {
  agentName?: string;
  hostName?: string;
  providerUrls?: string[];
};

export type AgentAuthThinkOptions = {
  client?: AgentAuthClientLike;
  storage?: AgentAuthStorage;
  directoryUrl?: string;
  providerUrls?: string[];
  hostName?: string;
  agentName?: string | ((context: AgentAuthThinkContext) => string);
  prefix?: string;
  tools?: Partial<Record<AgentAuthBaseToolName, boolean>>;
  noBrowser?: boolean;
  approvalTimeoutMs?: number;
  onApprovalRequired?: (approval: AgentAuthApprovalRequired) => void | Promise<void>;
};

export type AgentAuthBaseToolName =
  | "list_providers"
  | "search_providers"
  | "discover_provider"
  | "list_capabilities"
  | "describe_capability"
  | "connect_agent"
  | "agent_status"
  | "request_capability"
  | "disconnect_agent"
  | "reactivate_agent"
  | "execute_capability";

export type AgentAuthToolNames = `agentauth_${AgentAuthBaseToolName}`;

export type AgentAuthApprovalRequired = {
  status: "pending_approval";
  verificationUri?: string;
  verificationUriComplete?: string;
  userCode?: string;
  deviceCode?: string;
  method?: string;
  expiresIn?: number;
  expiresAt?: string;
  interval?: number;
  raw: unknown;
};

export type AgentAuthThinkTools = ToolSet;
