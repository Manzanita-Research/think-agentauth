import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function createRouterInstance() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
  });
}

export const createRouter = createRouterInstance;
export const getRouter = createRouterInstance;

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouterInstance>;
  }
}
