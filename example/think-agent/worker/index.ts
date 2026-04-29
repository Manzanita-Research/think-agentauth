import { createAgentAuthTools, createThinkSqlStorage } from "@agentauth/think";
import { Think } from "@cloudflare/think";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import { defaultAgentState, type DemoThinkAgentState } from "../src/agent-state";

export interface Env {
  AI: Ai;
  ASSETS: Fetcher;
  DemoThinkAgent: DurableObjectNamespace<DemoThinkAgent>;
  AGENTAUTH_PROVIDER_URL?: string;
  AGENTAUTH_HOST_NAME?: string;
}

export class DemoThinkAgent extends Think<Env, DemoThinkAgentState> {
  initialState = defaultAgentState;

  onStart() {
    if (!this.state?.agentName) {
      this.setState(defaultAgentState);
    }
  }

  getModel() {
    return createWorkersAI({ binding: this.env.AI })("@cf/moonshotai/kimi-k2.5");
  }

  getSystemPrompt() {
    return [
      "You are a local demo Think agent showing how AgentAuth works.",
      `Your display name is ${this.state.agentName}.`,
      "Use the agentauth_* tools when the user asks you to connect to providers or work with external capabilities.",
      "The local demo provider is usually http://localhost:3000.",
      "If an AgentAuth call returns pending approval, do not build a markdown approval form or table. The chat UI renders the approval card from the tool result. Briefly tell the user to use that card and wait for approval.",
    ].join("\n");
  }

  getTools() {
    return createAgentAuthTools({
      storage: createThinkSqlStorage(this.ctx.storage.sql),
      providerUrls: [this.env.AGENTAUTH_PROVIDER_URL ?? "http://localhost:3000"],
      hostName: this.env.AGENTAUTH_HOST_NAME ?? "Local Think Demo",
      agentName: () => this.state.agentName,
      noBrowser: true,
    });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return agentResponse;
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
