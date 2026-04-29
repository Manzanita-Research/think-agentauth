# AgentAuth Think Monorepo

This workspace contains a Think-native AgentAuth adapter and a two-app local demo.

- `packages/think` exports `@agentauth/think`, a small adapter that exposes AgentAuth client operations as AI SDK tools for Cloudflare Think agents.
- `example/think-agent` is a dummy Cloudflare Think Worker with a minimal browser chat UI.
- `example/provider-app` is a TanStack Start app that hosts a Better Auth AgentAuth provider with two dummy capabilities.

## Run Locally

```bash
pnpm install
pnpm dev
```

Local URLs:

- Provider app: http://localhost:3000
- Think agent: http://localhost:8787

Both dev servers use strict ports. If either port is already occupied, stop the
old process and restart `pnpm dev`; do not use Vite's fallback port, because the
agent and provider are configured to talk to these exact local origins.

Happy path:

1. Open the provider app and click `Reset demo` for a clean recording state.
2. Open the Think agent chat UI.
3. Use the `Connect and create note` starter chip, or ask: `Discover http://localhost:3000, connect as Scribe, and create a note titled "Hello AgentAuth".`
4. When the agent receives a pending approval result, open the provider approval URL shown in the tool result.
5. Approve the request in the provider app.
6. Ask the agent to continue and execute `create_note`.

The provider exposes `list_notes` as an auto-granted read capability and `create_note` as a mutating capability requiring demo approval.

Provider demo data lives in Wrangler's local D1 storage for the `agentauth-demo` database, including AgentAuth records and notes created by agents. Restarting the dev server keeps the notes; the provider UI's `Reset demo` button restores the welcome note and clears local AgentAuth demo records.

## Scripts

```bash
pnpm dev
pnpm dev:provider
pnpm dev:agent
pnpm build
pnpm typecheck
pnpm test
```

## Security Note

The example approval page is intentionally simple and demo-only. Real mutating capabilities should require WebAuthn or an out-of-band approval channel when the agent may control the user's browser.
