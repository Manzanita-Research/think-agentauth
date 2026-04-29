import { auth } from "@/lib/auth";
import { ensureDatabase } from "@/lib/database";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        await ensureDatabase();
        return auth.handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        await ensureDatabase();
        return auth.handler(request);
      },
    },
  },
});
