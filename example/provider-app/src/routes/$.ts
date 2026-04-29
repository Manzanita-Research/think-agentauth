import { auth } from "@/lib/auth";
import { ensureDatabase } from "@/lib/database";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        if (url.pathname === "/.well-known/agent-configuration") {
          await ensureDatabase();
          return Response.json(await auth.api.getAgentConfiguration());
        }

        return new Response("Not Found", { status: 404 });
      },
    },
  },
});
