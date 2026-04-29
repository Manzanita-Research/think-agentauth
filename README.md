# AgentAuth Think

AgentAuth Think is a small TypeScript monorepo exploring how [Agent Auth](https://agentauthprotocol.com/) can feel native inside [Cloudflare Think](https://developers.cloudflare.com/agents/api-reference/think/) agents.

The core idea is simple: a Think agent should be able to discover a provider, request narrowly scoped capabilities, pause for user approval when needed, and then execute the approved capability as a normal AI SDK tool call. The agent gets an auditable identity of its own, the provider gets capability-level control, and the human gets a visible consent moment instead of a mystery token floating around in the background.

## What Is In This Repo

- `packages/think` publishes `@agentauth/think`, a reusable adapter that exposes AgentAuth client operations as Think-ready AI SDK tools.
- `example/think-agent` is a Cloudflare Think Worker with a chat UI for a local agent named Scribe.
- `example/provider-app` is a TanStack Start app on Cloudflare Workers that acts as a Better Auth AgentAuth provider.

The provider demo exposes two capabilities:

- `list_notes`: read-only, auto-granted.
- `create_note`: mutating, requires an approval step in the provider UI.

The local demo is deliberately tiny, but the shape is the important part: Think handles the agent loop and tool surface, AgentAuth handles provider discovery and capability grants, and Better Auth provides the example provider implementation.

## Related Projects And Docs

- [Agent Auth Protocol](https://agentauthprotocol.com/): protocol overview for agent identity, discovery, capability grants, lifecycle, and approval.
- [Agent Auth SDKs](https://agentauthprotocol.com/docs/sdks): official SDKs, including the client this adapter wraps.
- [Agent Auth MCP tools](https://agentauthprotocol.com/docs/mcp): vocabulary this package mirrors where practical: discover, list, connect, status, request, execute, disconnect.
- [Cloudflare Think docs](https://developers.cloudflare.com/agents/api-reference/think/): Cloudflare's agent runtime for workspace-aware AI agents.
- [Cloudflare Agents repository](https://github.com/cloudflare/agents/blob/main/docs/think/index.md): source docs for Project Think.
- [Better Auth Agent Auth plugin](https://better-auth.com/docs/plugins/agent-auth): provider-side Better Auth plugin used by the example app.
- [TanStack Start on Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/): deployment model used by the provider demo.

## How The Flow Works

The demo flow is intentionally close to the protocol vocabulary:

1. `discover_provider`: Scribe loads the provider's `/.well-known/agent-configuration`.
2. `list_capabilities`: Scribe asks what the provider can do.
3. `connect_agent`: Scribe registers itself with the provider as an AgentAuth agent and requests `create_note`.
4. Approval: the provider returns a verification code and approval URL. The user reviews the request in the provider app.
5. `agent_status`: Scribe checks whether the grant is active.
6. `execute_capability`: Scribe calls `create_note` with the approved grant.

In the UI, the Think app shows tool calls as purpose-built cards instead of raw JSON, while the provider app shows the approval request and a live-updating notes ledger. This makes the handoff visible during a side-by-side demo: the agent asks, the provider pauses, the human approves, and the capability executes.

## Package API

`@agentauth/think` exposes a deliberately small API:

```ts
import {
  createAgentAuthTools,
  createThinkSqlStorage,
} from "@agentauth/think";
```

### `createAgentAuthTools(options)`

Creates a Think-compatible AI SDK `ToolSet`.

By default it exposes AgentAuth tools with an `agentauth_` prefix:

- `agentauth_list_providers`
- `agentauth_search_providers`
- `agentauth_discover_provider`
- `agentauth_list_capabilities`
- `agentauth_describe_capability`
- `agentauth_connect_agent`
- `agentauth_agent_status`
- `agentauth_request_capability`
- `agentauth_disconnect_agent`
- `agentauth_reactivate_agent`
- `agentauth_execute_capability`

The adapter wraps the official AgentAuth client SDK instead of reimplementing the protocol. It normalizes pending approval responses into a Think-friendly JSON shape so the chat UI can render a useful approval card.

### `createThinkSqlStorage(sql)`

Creates a storage adapter for Think/Durable Object SQLite-style storage. The adapter persists provider configs, host identity, and agent connection records so the agent can recover local AgentAuth state across turns.

## Local Demo

Install dependencies:

```bash
pnpm install
```

Run both apps:

```bash
pnpm dev
```

Local URLs:

- Provider app: [http://localhost:3000](http://localhost:3000)
- Think agent: [http://localhost:8787](http://localhost:8787)

Both dev servers use strict ports. If either port is already occupied, stop the old process and restart `pnpm dev`; do not use Vite's fallback port, because the agent and provider are configured to talk to these exact local origins.

Happy path:

1. Open the provider app and click `Reset demo` for a clean recording state.
2. Open the Think agent chat UI.
3. Use the `Connect and create note` starter chip, or ask:

   ```text
   Discover http://localhost:3000, connect as Scribe, and create a note titled "Hello AgentAuth".
   ```

4. When Scribe receives a pending approval result, open the provider approval URL shown in the approval card.
5. Confirm that the verification code matches, then approve the request in the provider app.
6. Ask Scribe to continue. It will check status and execute `create_note`.
7. Watch the provider ledger auto-refresh with the new note and agent attribution.

Provider demo data lives in Wrangler's local D1 storage for the `agentauth-demo` database, including AgentAuth records and notes created by agents. Restarting the dev server keeps notes around; the provider UI's `Reset demo` button restores the welcome note and clears local AgentAuth demo records.

## Scripts

```bash
pnpm dev
pnpm dev:provider
pnpm dev:agent
pnpm build
pnpm typecheck
pnpm test
```

`pnpm test` currently runs the package unit tests for `@agentauth/think`.

## Security Notes

This is a local demo, not a production approval system.

- The adapter never exposes private keys to the model; tool results are shaped around provider metadata, agent IDs, capability names, and approval URLs.
- The provider approval page is intentionally simple and browser-based.
- Real mutating capabilities should use stronger approval, such as WebAuthn or an out-of-band confirmation channel, especially when the agent may control the user's browser.
- Capability descriptions should stay concrete and auditable. The provider should know which agent acted, which capability ran, and what grant authorized it.

## Why This Exists

Think already has a natural place for tools: `getTools()`. AgentAuth adds the missing interop story for external providers: discovery, per-agent identity, provider-controlled grants, and approval flows. This package is the bridge between those two ideas.

The rough target is:

```ts
getTools() {
  return {
    ...createAgentAuthTools({
      agentName: "Scribe",
      storage: createThinkSqlStorage(this.sql),
    }),
  };
}
```

That lets a Think agent use any AgentAuth-compatible provider without each agent project rebuilding the protocol glue.
