import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Streamdown } from "streamdown";
import { listNotes, resetDemoData } from "../lib/notes";

const getNotes = createServerFn({ method: "GET" }).handler(() => listNotes());

export const Route = createFileRoute("/")({
  loader: () => getNotes(),
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        await resetDemoData();
        const url = new URL(request.url);
        url.searchParams.set("reset", "1");
        return Response.redirect(url.toString(), 303);
      },
    },
  },
  component: Home,
});

function Home() {
  const initialNotes = Route.useLoaderData();
  const [notes, setNotes] = useState(initialNotes);
  const [freshNoteIds, setFreshNoteIds] = useState<Set<string>>(new Set());
  const [liveState, setLiveState] = useState<"watching" | "updated" | "offline">(
    "watching",
  );

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    let cancelled = false;
    let freshTimer: number | undefined;

    const refreshNotes = async () => {
      try {
        const nextNotes = await getNotes();
        if (cancelled) {
          return;
        }

        setNotes((currentNotes) => {
          const currentIds = new Set(currentNotes.map((note) => note.id));
          const incomingIds = nextNotes
            .filter((note) => !currentIds.has(note.id))
            .map((note) => note.id);

          if (incomingIds.length) {
            setFreshNoteIds(new Set(incomingIds));
            setLiveState("updated");
            window.clearTimeout(freshTimer);
            freshTimer = window.setTimeout(() => {
              setFreshNoteIds(new Set());
              setLiveState("watching");
            }, 3600);
          } else {
            setLiveState("watching");
          }

          return nextNotes;
        });
      } catch {
        if (!cancelled) {
          setLiveState("offline");
        }
      }
    };

    const interval = window.setInterval(refreshNotes, 1400);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(freshTimer);
    };
  }, []);

  return (
    <main className="shell">
      <section className="registry-hero">
        <div>
          <p className="eyebrow">Demo Notes Provider</p>
          <h1>Capability registry</h1>
          <p>
            A local Better Auth AgentAuth provider for Think agents. It publishes
            discovery metadata, lists note capabilities, and reviews delegated access.
          </p>
        </div>
        <aside className="registry-stamp" aria-label="Provider status">
          <span>Provider</span>
          <strong>Active</strong>
          <small>localhost:3000</small>
        </aside>
      </section>

      <section className="registry-grid" aria-label="AgentAuth provider records">
        <article className="record-panel discovery-panel">
          <div className="panel-heading">
            <span>Discovery</span>
            <strong>Well-known route</strong>
          </div>
          <div className="route-card" aria-label="AgentAuth discovery endpoint">
            <div className="route-token">
              <span>GET</span>
              <code>/.well-known/agent-configuration</code>
            </div>
            <p>Entry record for issuer, modes, endpoints, algorithms, and approval methods.</p>
          </div>
          <dl className="discovery-points">
            <div>
              <dt>Issuer</dt>
              <dd>/api/auth</dd>
            </div>
            <div>
              <dt>Modes</dt>
              <dd>delegated, autonomous</dd>
            </div>
            <div>
              <dt>Approval</dt>
              <dd>device flow</dd>
            </div>
          </dl>
        </article>

        <article className="record-panel capabilities-panel">
          <div className="panel-heading">
            <span>Capabilities</span>
            <strong>2 exposed</strong>
          </div>
          <div className="capability-row">
            <code>list_notes</code>
            <span>Auto granted</span>
          </div>
          <div className="capability-row requires-review">
            <code>create_note</code>
            <span>Approval required</span>
          </div>
        </article>
      </section>

      <section className="ledger">
        <div className="panel-heading ledger-heading">
          <div>
            <span>Notes ledger</span>
            <strong>{notes.length} records</strong>
            <em className={`live-indicator ${liveState}`}>
              <i aria-hidden="true" />
              {liveState === "updated"
                ? "New note arrived"
                : liveState === "offline"
                  ? "Sync paused"
                  : "Watching D1"}
            </em>
          </div>
          <form method="post">
            <button className="reset-button" type="submit">
              Reset demo
            </button>
          </form>
        </div>
        {notes.length ? (
          <ul className="notes-list">
            {notes.map((note) => (
              <li
                key={note.id}
                className={`note-row ${freshNoteIds.has(note.id) ? "fresh-note" : ""}`}
              >
                <div>
                  <small>{note.id}</small>
                  <strong>{note.title}</strong>
                  {note.body ? (
                    <Streamdown
                      className="note-body"
                      controls={{ code: false, table: false, mermaid: false }}
                      linkSafety={{
                        enabled: true,
                        onLinkCheck: isTrustedProviderDemoUrl,
                        renderModal: LinkSafetyModal,
                      }}
                    >
                      {note.body}
                    </Streamdown>
                  ) : (
                    <span>No body text</span>
                  )}
                </div>
                <footer>
                  <span>{note.createdByAgentName ?? "Unknown agent"}</span>
                  <time dateTime={note.createdAt}>
                    {new Date(note.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                  </time>
                </footer>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-ledger">No notes yet. Ask the Think agent to create one.</p>
        )}
      </section>
    </main>
  );
}

function isTrustedProviderDemoUrl(url: string) {
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
    <div className="link-safety-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="link-safety-modal"
        aria-modal="true"
        role="dialog"
        aria-labelledby="link-safety-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">External link</p>
        <h2 id="link-safety-title">Leave the provider demo?</h2>
        <p>Check this note link before opening it in a new tab.</p>
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
