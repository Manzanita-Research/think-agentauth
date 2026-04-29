import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type React from "react";
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Streamdown } from "streamdown";
import { defaultAgentName, type DemoThinkAgentState } from "./agent-state";
import "./styles.css";

type ToolPart = {
  type: string;
  toolName?: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
};

type Capability = {
  name?: string;
  description?: string;
  approval_strength?: string;
  approvalStrength?: string;
  input_fields?: Array<{ name?: string; type?: string }>;
};

type PendingApproval = {
  status?: string;
  agent_id?: string;
  agentId?: string;
  approval?: {
    userCode?: string;
    verificationUri?: string;
    verificationUriComplete?: string;
    expiresIn?: number;
    interval?: number;
  };
};

function isToolPart(part: unknown): part is ToolPart {
  return (
    typeof part === "object" &&
    part !== null &&
    "type" in part &&
    typeof (part as { type: unknown }).type === "string" &&
    (part as { type: string }).type.startsWith("tool-")
  );
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function shortUrl(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname}`;
  } catch {
    return value;
  }
}

function formatToolName(toolName: string) {
  return toolName
    .replace(/^agentauth_/, "")
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function formatExpires(seconds?: number) {
  if (!seconds) {
    return "soon";
  }
  if (seconds < 90) {
    return `${seconds} seconds`;
  }
  return `${Math.round(seconds / 60)} minutes`;
}

function providerName(output: Record<string, unknown>) {
  return String(
    output.provider_name ?? output.name ?? output.issuer ?? "Provider",
  );
}

function outputOf(part?: ToolPart) {
  return part ? toRecord(part.output) : {};
}

function toolPartName(part: ToolPart) {
  return part.toolName ?? part.type.replace(/^tool-/, "");
}

function isPendingApproval(part: ToolPart) {
  const output = outputOf(part) as PendingApproval;
  return output.status === "pending_approval" || Boolean(output.approval);
}

function removeRedundantApprovalWidget(
  text: string,
  hasPendingApprovalCard: boolean,
) {
  if (
    !hasPendingApprovalCard ||
    !/approval required/i.test(text) ||
    !/(approval url|user code|verification code|please approve)/i.test(text)
  ) {
    return text;
  }

  const lines = text.split("\n");
  const widgetStart = lines.findIndex((line) =>
    /approval required/i.test(line),
  );
  if (widgetStart < 0) {
    return text;
  }

  return lines.slice(0, widgetStart).join("\n").trim();
}

function isTrustedDemoUrl(url: string) {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      (parsed.port === "3000" || parsed.port === "8787")
    );
  } catch {
    return false;
  }
}

function LinkSafetyModal({
  isOpen,
  onClose,
  onConfirm,
  url,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  url: string;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="link-safety-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="link-safety-modal"
        aria-modal="true"
        role="dialog"
        aria-labelledby="link-safety-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">External link</p>
        <h2 id="link-safety-title">Leave the demo workspace?</h2>
        <p>
          Scribe is pointing at a URL outside this local flow. Check the
          destination before opening it in a new tab.
        </p>
        <code>{url}</code>
        <div className="link-safety-actions">
          <button type="button" onClick={onConfirm}>
            Open link
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Stay here
          </button>
        </div>
      </section>
    </div>
  );
}

function normalizeCapabilityRequest(capability: unknown) {
  if (typeof capability === "string") {
    return { name: capability };
  }
  const record = toRecord(capability);
  return {
    name: String(record.name ?? "capability"),
    constraints: toRecord(record.constraints),
  };
}

function ToolResult({ part }: { part: ToolPart }) {
  const toolName = toolPartName(part);
  const output = toRecord(part.output);

  if (part.state === "output-error") {
    return (
      <section className="tool-card danger">
        <div className="tool-card-header">
          <span>{formatToolName(toolName)}</span>
          <strong>Failed</strong>
        </div>
        <p>{part.errorText ?? "The provider returned an error."}</p>
        <RawToolDetails part={part} />
      </section>
    );
  }

  if (toolName === "agentauth_discover_provider") {
    return <ProviderCard output={output} part={part} />;
  }

  if (toolName === "agentauth_list_capabilities") {
    return <CapabilitiesCard output={output} part={part} />;
  }

  if (toolName === "agentauth_describe_capability") {
    return <CapabilityDetailCard output={output} part={part} />;
  }

  if (
    toolName === "agentauth_connect_agent" ||
    toolName === "agentauth_request_capability"
  ) {
    const pending = output as PendingApproval;
    if (pending.status === "pending_approval" || pending.approval) {
      return <ApprovalCard output={pending} part={part} />;
    }
    return <ConnectionCard output={output} part={part} />;
  }

  if (toolName === "agentauth_agent_status") {
    return <StatusCard output={output} part={part} />;
  }

  if (toolName === "agentauth_execute_capability") {
    return <ExecutionCard output={output} part={part} />;
  }

  return (
    <section className="tool-card compact">
      <div className="tool-card-header">
        <span>{formatToolName(toolName)}</span>
        <strong>
          {part.state === "output-available" ? "Done" : "Running"}
        </strong>
      </div>
      <RawToolDetails part={part} />
    </section>
  );
}

function ProviderCard({
  output,
  part,
}: {
  output: Record<string, unknown>;
  part: ToolPart;
}) {
  const modes = Array.isArray(output.modes) ? output.modes : [];
  const approvalMethods = Array.isArray(output.approval_methods)
    ? output.approval_methods
    : [];

  return (
    <section className="tool-card">
      <div className="tool-card-header">
        <span>Provider Discovered</span>
        <strong>{providerName(output)}</strong>
      </div>
      <p>{String(output.description ?? "AgentAuth provider is available.")}</p>
      <dl className="tool-facts">
        <div>
          <dt>Issuer</dt>
          <dd>{shortUrl(output.issuer)}</dd>
        </div>
        <div>
          <dt>Modes</dt>
          <dd>{modes.map(String).join(", ") || "not specified"}</dd>
        </div>
        <div>
          <dt>Approvals</dt>
          <dd>{approvalMethods.map(String).join(", ") || "not specified"}</dd>
        </div>
      </dl>
      <RawToolDetails part={part} />
    </section>
  );
}

function CapabilitiesCard({
  output,
  part,
}: {
  output: Record<string, unknown>;
  part: ToolPart;
}) {
  const capabilities = Array.isArray(output.capabilities)
    ? (output.capabilities as Capability[])
    : [];

  return (
    <section className="tool-card">
      <div className="tool-card-header">
        <span>Capabilities</span>
        <strong>{capabilities.length} available</strong>
      </div>
      <div className="capability-list">
        {capabilities.map((capability) => {
          const approval =
            capability.approval_strength ?? capability.approvalStrength;
          return (
            <article key={capability.name} className="capability-item">
              <div>
                <strong>{capability.name}</strong>
                <p>{capability.description}</p>
                {capability.input_fields?.length ? (
                  <small>
                    Inputs:{" "}
                    {capability.input_fields
                      .map(
                        (field) =>
                          `${field.name ?? "field"}:${field.type ?? "unknown"}`,
                      )
                      .join(", ")}
                  </small>
                ) : null}
              </div>
              <span className={approval ? "badge warn" : "badge"}>
                {approval ? `${approval} approval` : "auto granted"}
              </span>
            </article>
          );
        })}
      </div>
      <RawToolDetails part={part} />
    </section>
  );
}

function CapabilityDetailCard({
  output,
  part,
}: {
  output: Record<string, unknown>;
  part: ToolPart;
}) {
  const input = toRecord(output.input);
  const properties = toRecord(input.properties);
  const required = Array.isArray(input.required)
    ? input.required.map(String)
    : [];
  const fields = Object.entries(properties).map(([name, schema]) => {
    const schemaRecord = toRecord(schema);
    return {
      name,
      type: String(schemaRecord.type ?? "unknown"),
      required: required.includes(name),
    };
  });
  const approval = output.approval_strength ?? output.approvalStrength;

  return (
    <section className="tool-card">
      <div className="tool-card-header">
        <span>Capability Detail</span>
        <strong>
          {String(output.name ?? part.input?.name ?? "Capability")}
        </strong>
      </div>
      <p>
        {String(
          output.description ?? "Capability schema returned by the provider.",
        )}
      </p>
      {fields.length ? (
        <div className="capability-list">
          {fields.map((field) => (
            <article key={field.name} className="capability-item compact-row">
              <div>
                <strong>{field.name}</strong>
                <small>{field.type}</small>
              </div>
              <span className={field.required ? "badge warn" : "badge"}>
                {field.required ? "required" : "optional"}
              </span>
            </article>
          ))}
        </div>
      ) : null}
      {approval ? (
        <div className="approval-scopes">
          <span>{String(approval)} approval</span>
        </div>
      ) : null}
      <RawToolDetails part={part} />
    </section>
  );
}

function ApprovalCard({
  output,
  part,
}: {
  output: PendingApproval;
  part: ToolPart;
}) {
  const approval = output.approval ?? {};
  const approvalUrl =
    approval.verificationUriComplete ?? approval.verificationUri;
  const agentName = String(part.input?.name ?? defaultAgentName);
  const provider = String(part.input?.provider ?? "Provider");
  const mode = String(part.input?.mode ?? "delegated");
  const reason =
    typeof part.input?.reason === "string" ? part.input.reason : undefined;
  const capabilities = Array.isArray(part.input?.capabilities)
    ? part.input.capabilities.map(normalizeCapabilityRequest)
    : [];

  return (
    <section className="tool-card approval-card">
      <div className="approval-hero">
        <div>
          <span>Approval Required</span>
          <h3>{agentName} is asking for access</h3>
          <p>
            {reason ??
              `Connect to ${shortUrl(provider) || provider} with AgentAuth.`}
          </p>
        </div>
        <div className="verification-code">
          <span>Verification code</span>
          <strong>{approval.userCode ?? "Pending"}</strong>
        </div>
      </div>

      <div className="approval-body">
        {capabilities.length ? (
          <div className="approval-access">
            <span>Requested access</span>
            <div>
              {capabilities.map((capability) => (
                <strong key={capability.name}>{capability.name}</strong>
              ))}
            </div>
          </div>
        ) : null}

        <dl className="approval-meta">
          <div>
            <dt>Provider</dt>
            <dd>{shortUrl(provider) || provider}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{mode}</dd>
          </div>
          <div>
            <dt>Expires</dt>
            <dd>{formatExpires(approval.expiresIn)}</dd>
          </div>
          <div>
            <dt>Agent ID</dt>
            <dd>{output.agent_id ?? output.agentId ?? "pending"}</dd>
          </div>
        </dl>
      </div>

      {approvalUrl ? (
        <a
          className="approval-link"
          href={approvalUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open approval in provider
        </a>
      ) : null}
      <RawToolDetails part={part} />
    </section>
  );
}

function ConnectionCard({
  output,
  part,
}: {
  output: Record<string, unknown>;
  part: ToolPart;
}) {
  return (
    <section className="tool-card compact">
      <div className="tool-card-header">
        <span>Agent Connection</span>
        <strong>{String(output.status ?? "updated")}</strong>
      </div>
      <RawToolDetails part={part} />
    </section>
  );
}

function StatusCard({
  output,
  part,
}: {
  output: Record<string, unknown>;
  part: ToolPart;
}) {
  const grants = Array.isArray(output.capabilities)
    ? output.capabilities
    : Array.isArray(output.grants)
      ? output.grants
      : [];

  return (
    <section className="tool-card compact">
      <div className="tool-card-header">
        <span>Agent Status</span>
        <strong>{String(output.status ?? "active")}</strong>
      </div>
      {grants.length ? (
        <div className="approval-scopes">
          {grants.map((grant) => (
            <span key={JSON.stringify(grant)}>
              {typeof grant === "string"
                ? grant
                : String(toRecord(grant).capability ?? toRecord(grant).name)}
            </span>
          ))}
        </div>
      ) : null}
      <RawToolDetails part={part} />
    </section>
  );
}

function ExecutionCard({
  output,
  part,
}: {
  output: Record<string, unknown>;
  part: ToolPart;
}) {
  const data = toRecord(output.data ?? output.result ?? output);
  const capability = String(part.input?.capability ?? "Capability");
  const body = typeof data.body === "string" ? data.body.trim() : "";

  return (
    <section className="tool-card success">
      <div className="tool-card-header">
        <span>Capability Executed</span>
        <strong>{capability}</strong>
      </div>
      {data.title ? (
        <p>
          Created <strong>{String(data.title)}</strong>
          {data.createdByAgentName
            ? ` by ${String(data.createdByAgentName)}`
            : ""}
          .
        </p>
      ) : (
        <p>The provider returned a successful result.</p>
      )}
      {body ? (
        <section className="execution-body">
          <span>Body</span>
          <Streamdown
            className="markdown execution-markdown"
            controls={{ code: false, table: false, mermaid: false }}
            linkSafety={{
              enabled: true,
              onLinkCheck: isTrustedDemoUrl,
              renderModal: LinkSafetyModal,
            }}
          >
            {body}
          </Streamdown>
        </section>
      ) : null}
      {Object.keys(data).length ? (
        <dl className="tool-facts">
          {Object.entries(data)
            .filter(
              ([key, value]) =>
                key !== "body" &&
                (typeof value === "string" || typeof value === "number"),
            )
            .slice(0, 4)
            .map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
        </dl>
      ) : null}
      <RawToolDetails part={part} />
    </section>
  );
}

function RawToolDetails({ part }: { part: ToolPart }) {
  return (
    <details className="raw-tool">
      <summary>Raw tool result</summary>
      <pre>{JSON.stringify(part, null, 2)}</pre>
    </details>
  );
}

function AgentAuthPanel({ toolParts }: { toolParts: ToolPart[] }) {
  const latest = (name: string) =>
    [...toolParts].reverse().find((part) => toolPartName(part) === name);
  const provider = latest("agentauth_discover_provider");
  const capabilities = latest("agentauth_list_capabilities");
  const status = latest("agentauth_agent_status");
  const execution = latest("agentauth_execute_capability");
  const approval = [...toolParts]
    .reverse()
    .find(
      (part) =>
        (toolPartName(part) === "agentauth_connect_agent" ||
          toolPartName(part) === "agentauth_request_capability") &&
        isPendingApproval(part),
    );
  const capabilityOutput = outputOf(capabilities);
  const capabilityList = Array.isArray(capabilityOutput.capabilities)
    ? (capabilityOutput.capabilities as Capability[])
    : [];

  return (
    <aside className="flow-panel" aria-label="AgentAuth flow">
      <div className="flow-panel-header">
        <p className="eyebrow">AgentAuth</p>
        <h2>Flow</h2>
      </div>
      <FlowStep
        title="Discovery"
        state={provider ? "done" : "waiting"}
        detail={
          provider
            ? providerName(outputOf(provider))
            : "Ask the agent to discover an AgentAuth provider."
        }
      />
      <FlowStep
        title="Capabilities"
        state={capabilityList.length ? "done" : "waiting"}
        detail={
          capabilityList.length
            ? `${capabilityList.length} capabilities found`
            : "Capabilities will appear after discovery."
        }
      >
        {capabilityList.length ? (
          <div className="flow-capabilities">
            {capabilityList.map((capability) => {
              const approval =
                capability.approval_strength ?? capability.approvalStrength;
              return (
                <span key={capability.name}>
                  <code>{capability.name}</code>
                  {approval ? ` requires ${approval}` : " auto granted"}
                </span>
              );
            })}
          </div>
        ) : null}
      </FlowStep>
      <FlowStep
        title="Approval"
        state={approval ? "attention" : status ? "done" : "waiting"}
        detail={
          approval
            ? `Code ${(outputOf(approval) as PendingApproval).approval?.userCode ?? "pending"}`
            : status
              ? "Connection checked"
              : "Mutating capabilities pause here for review."
        }
      />
      <FlowStep
        title="Execution"
        state={execution ? "done" : "waiting"}
        detail={
          execution
            ? String(toolPartName(execution).replace(/^agentauth_/, ""))
            : "Successful capability calls show up in chat."
        }
      />
    </aside>
  );
}

function FlowStep({
  title,
  state,
  detail,
  children,
}: {
  title: string;
  state: "waiting" | "attention" | "done";
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={`flow-step ${state}`}>
      <div>
        <span className="flow-dot" />
        <strong>{title}</strong>
      </div>
      <p>{detail}</p>
      {children}
    </section>
  );
}

function App() {
  const agent = useAgent<DemoThinkAgentState>({
    agent: "DemoThinkAgent",
    name: "local-demo",
  });
  const { messages, sendMessage, status, clearHistory } = useAgentChat({
    agent,
  });
  const agentDisplayName = agent.state?.agentName ?? defaultAgentName;
  const demoPrompt = `Discover http://localhost:3000, connect as "${defaultAgentName}", and create a note titled "Hello AgentAuth" with markdown explaining what this demo is showing <3`;
  const transcriptRef = useRef<HTMLElement | null>(null);
  const toolParts: ToolPart[] = messages.flatMap((message) =>
    message.parts.flatMap((part) => (isToolPart(part) ? [part] : [])),
  );
  const latestMessageText =
    messages
      .at(-1)
      ?.parts.map((part) => (part.type === "text" ? part.text : ""))
      .join("") ?? "";
  const [input, setInput] = useState("");
  const submitMessage = (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || status === "streaming") {
      return;
    }
    sendMessage({ text });
    setInput("");
  };

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) {
      return;
    }

    transcript.scrollTo({
      top: transcript.scrollHeight,
      behavior: "smooth",
    });
  }, [latestMessageText, messages.length, status]);

  return (
    <main className="app">
      <header>
        <div>
          <p className="eyebrow">Think Agent Workbench</p>
          <h1>Scribe</h1>
        </div>
        <button
          className="clear-button"
          type="button"
          onClick={clearHistory}
          disabled={status === "streaming" || messages.length === 0}
        >
          Reset thread
        </button>
      </header>

      <div className="workspace">
        <div className="chat-column">
          <section
            ref={transcriptRef}
            className="transcript"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <p className="empty">
                Ask Scribe to discover the provider, request access, then create
                or list notes.
              </p>
            ) : null}
            {messages.map((message, messageIndex) => {
              const isLatestAssistant =
                message.role === "assistant" &&
                messageIndex === messages.length - 1;
              const hasPendingApprovalCard = message.parts.some(
                (part) => isToolPart(part) && isPendingApproval(part),
              );
              const messageLabel =
                message.role === "assistant"
                  ? agentDisplayName
                  : message.role === "user"
                    ? "You"
                    : message.role;

              return (
                <article key={message.id} className={`message ${message.role}`}>
                  <strong className="message-label">{messageLabel}</strong>
                  <div>
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        const text = removeRedundantApprovalWidget(
                          part.text,
                          hasPendingApprovalCard,
                        );
                        if (!text) {
                          return null;
                        }
                        if (message.role === "user") {
                          return (
                            <p key={index} className="plain-message">
                              {text}
                            </p>
                          );
                        }
                        return (
                          <Streamdown
                            key={index}
                            className="markdown"
                            isAnimating={
                              status === "streaming" && isLatestAssistant
                            }
                            linkSafety={{
                              enabled: true,
                              onLinkCheck: isTrustedDemoUrl,
                              renderModal: LinkSafetyModal,
                            }}
                          >
                            {text}
                          </Streamdown>
                        );
                      }
                      if (isToolPart(part)) {
                        return <ToolResult key={index} part={part} />;
                      }
                      return null;
                    })}
                  </div>
                </article>
              );
            })}
          </section>

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitMessage();
            }}
          >
            <div className="prompt-strip" aria-label="Demo prompt shortcuts">
              <span>Starter</span>
              <button
                type="button"
                onClick={() => submitMessage(demoPrompt)}
                disabled={status === "streaming"}
              >
                Connect and create note
              </button>
            </div>
            <label className="composer-field">
              <span>
                Prompt
                <kbd>⌘ Return</kbd>
              </span>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.metaKey) {
                    event.preventDefault();
                    submitMessage();
                  }
                }}
                rows={2}
                placeholder="Ask Scribe to use AgentAuth..."
              />
            </label>
            {/* <button
              className="send-button"
              type="submit"
              disabled={status === "streaming" || !input.trim()}
            >
              <span>{status === "streaming" ? "Working" : "Send"}</span>
              <small>to Scribe</small>
            </button> */}
          </form>
        </div>
        <AgentAuthPanel toolParts={toolParts} />
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
