import { resolveDemoApproval } from "@/lib/demo-approval";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/device/capabilities")({
  validateSearch: (search) => ({
    code:
      typeof search.code === "string"
        ? search.code
        : typeof search.user_code === "string"
          ? search.user_code
          : "",
    agent_id: typeof search.agent_id === "string" ? search.agent_id : "",
    result: typeof search.result === "string" ? search.result : "",
  }),
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const form = await request.formData();
        const action = String(form.get("action") ?? "approve");
        const agentId = String(form.get("agent_id") ?? "");
        const code = String(form.get("code") ?? "");

        if (action !== "approve" && action !== "deny") {
          return Response.json({ ok: false, message: "Invalid action" }, { status: 400 });
        }

        const result = await resolveDemoApproval({ agentId, action });
        const url = new URL(request.url);
        url.searchParams.set("agent_id", agentId);
        url.searchParams.set("code", code);
        url.searchParams.set(
          "result",
          result.ok ? (action === "approve" ? "approved" : "denied") : "missing",
        );
        return Response.redirect(url.toString(), 303);
      },
    },
  },
  component: ApprovalPage,
});

function ApprovalPage() {
  const search = Route.useSearch();
  const code = search.code;
  const agentId = search.agent_id;
  const result = search.result;

  if (result) {
    return (
      <main className="shell approval-shell">
        <section className="approval-header">
          <p className="eyebrow">Demo approval</p>
          <h1>
            {result === "approved"
              ? "Access granted to Scribe"
              : result === "denied"
                ? "Access denied"
                : "Request not found"}
          </h1>
          <p>
            {result === "approved"
              ? "Scribe can now call the note-writing capability through AgentAuth."
              : result === "denied"
                ? "Scribe will stay disconnected from the mutating note capability."
                : "The pending approval may have expired or the demo state was reset."}
          </p>
        </section>

        <section className={`consent-sheet approval-complete ${result}`}>
          <div className="completion-mark" aria-hidden="true">
            {result === "approved" ? "✓" : result === "denied" ? "×" : "?"}
          </div>
          <section className="consent-summary">
            <div>
              <span>Agent</span>
              <strong>Scribe</strong>
              <small>{agentId || "No agent id"}</small>
            </div>
            <div>
              <span>Capability</span>
              <strong>create_note</strong>
              <small>{code ? `Matched code ${code}` : "No code supplied"}</small>
            </div>
          </section>
          <p className="completion-copy">
            {result === "approved"
              ? "Return to the chat and tell Scribe to continue. The next capability execution should create the note."
              : "Return to the chat to retry the connection flow when you are ready."}
          </p>
          <a className="provider-link" href="/">
            View provider ledger
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="shell approval-shell">
      <section className="approval-header">
        <p className="eyebrow">Demo approval</p>
        <h1>Review delegated access</h1>
        <p>
          Match the code shown by the Think agent, then approve or deny the requested
          note-writing capability.
        </p>
      </section>

      <form className="consent-sheet" method="post">
        <div className="consent-code">
          <span>Verification code</span>
          <strong>{code || "Pending"}</strong>
        </div>

        <section className="consent-summary">
          <div>
            <span>Agent</span>
            <strong>Scribe</strong>
            <small>{agentId || "Waiting for agent id"}</small>
          </div>
          <div>
            <span>Requested access</span>
            <strong>create_note</strong>
            <small>Create a note in the Demo Notes ledger.</small>
          </div>
        </section>

        <input name="code" defaultValue={code} type="hidden" />
        <input name="agent_id" defaultValue={agentId} type="hidden" />

        <p className="demo-warning">
          Demo-only browser approval. Real mutating capabilities should use WebAuthn or
          an out-of-band approval channel.
        </p>

        <div className="actions">
          <button name="action" value="approve" type="submit">
            Approve access
          </button>
          <button name="action" value="deny" type="submit" className="secondary">
            Deny
          </button>
        </div>
      </form>
    </main>
  );
}
