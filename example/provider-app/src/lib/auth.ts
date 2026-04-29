import { agentAuth } from "@better-auth/agent-auth";
import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { database } from "./database";
import { createNote, listNotes } from "./notes";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "agentauth-think-demo-secret-local-only-please-replace",
  database,
  trustedOrigins: ["http://localhost:3000", "http://localhost:8787"],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    agentAuth({
      providerName: "Demo Notes",
      providerDescription: "A local notes provider for testing AgentAuth with Think agents.",
      modes: ["delegated", "autonomous"],
      allowDynamicHostRegistration: true,
      resolveAutonomousUser: async () => ({
        id: "demo-user",
        name: "Demo User",
        email: "demo@example.test",
      }),
      deviceAuthorizationPage: "/device/capabilities",
      defaultHostCapabilities: ["list_notes"],
      capabilities: [
        {
          name: "list_notes",
          description: "List notes visible to the demo user.",
          output: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                body: { type: "string" },
                createdAt: { type: "string" },
                createdByAgentName: { type: ["string", "null"] },
              },
            },
          },
        },
        {
          name: "create_note",
          description: "Create a new note in the demo provider.",
          approvalStrength: "session",
          input: {
            type: "object",
            required: ["title"],
            properties: {
              title: { type: "string" },
              body: { type: "string" },
            },
          },
          output: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              body: { type: "string" },
              createdAt: { type: "string" },
              createdByAgentName: { type: ["string", "null"] },
            },
          },
        },
      ],
      onExecute: async ({ capability, arguments: args, agentSession }) => {
        if (capability === "list_notes") {
          return await listNotes();
        }

        if (capability === "create_note") {
          const input = args as { title?: string; body?: string };
          if (!input.title) {
            throw new Error("create_note requires a title");
          }
          return await createNote({
            title: input.title,
            body: input.body,
            createdByAgentName: agentSession.agent.name,
          });
        }

        throw new Error(`Unsupported capability: ${capability}`);
      },
    }),
    tanstackStartCookies(),
  ],
});
