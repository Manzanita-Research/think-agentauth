import type {
  AgentAuthApprovalRequired,
  AgentAuthClientLike,
  AgentAuthThinkOptions,
} from "./types.js";

type AgentAuthModule = {
  AgentAuthClient?: new (options?: Record<string, unknown>) => AgentAuthClientLike;
};

export async function createAgentAuthClient(
  options: AgentAuthThinkOptions,
): Promise<AgentAuthClientLike> {
  if (options.client) {
    return options.client;
  }

  const mod = (await import("@auth/agent")) as unknown as AgentAuthModule;
  if (!mod.AgentAuthClient) {
    throw new Error("@auth/agent does not export AgentAuthClient.");
  }

  return new mod.AgentAuthClient({
    directoryUrl: options.directoryUrl,
    hostName: options.hostName,
    storage: options.storage,
    noBrowser: options.noBrowser ?? true,
    approvalTimeoutMs: options.approvalTimeoutMs,
    urls: options.providerUrls,
    onApprovalRequired: async (approval: unknown) => {
      await options.onApprovalRequired?.(normalizeApproval(approval));
    },
  });
}

export async function callClientMethod<T>(
  client: AgentAuthClientLike,
  names: readonly string[],
  args: unknown[],
): Promise<T> {
  for (const name of names) {
    const method = (client as Record<string, unknown>)[name];
    if (typeof method === "function") {
      return (method as (...methodArgs: unknown[]) => Promise<T>).apply(client, args);
    }
  }

  throw new Error(`AgentAuth client is missing method: ${names.join(" or ")}`);
}

export function normalizeApproval(raw: unknown): AgentAuthApprovalRequired {
  const record = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};

  return {
    status: "pending_approval",
    verificationUri: stringValue(record.verification_uri ?? record.verificationUri),
    verificationUriComplete: stringValue(
      record.verification_uri_complete ?? record.verificationUriComplete,
    ),
    userCode: stringValue(record.user_code ?? record.userCode),
    deviceCode: stringValue(record.device_code ?? record.deviceCode),
    method: stringValue(record.method),
    expiresIn: numberValue(record.expires_in ?? record.expiresIn),
    expiresAt: stringValue(record.expires_at ?? record.expiresAt),
    interval: numberValue(record.interval),
    raw,
  };
}

export function normalizeToolResult(result: unknown): unknown {
  if (!result || typeof result !== "object") {
    return result;
  }

  const record = result as Record<string, unknown>;
  const status = stringValue(record.status);
  const approval = record.approval ?? record.device_authorization ?? record.deviceAuthorization;

  if (status === "pending" || status === "pending_approval" || approval) {
    return {
      ...record,
      approval: normalizeApproval(approval ?? record),
    };
  }

  return result;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
