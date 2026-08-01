import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FlagEnvConfigSummary, FlagWithEnvironments, OrgRole } from "@togglr/shared-types";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { setCsrfToken } from "../api/csrf-store";
import { createQueryClient } from "../app/query-client";
import { AuthProvider } from "../auth/auth-context";
import { FlagsListRoute } from "./flags-list";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, apiFetch: apiFetchMock };
});

beforeEach(() => {
  setCsrfToken(null);
  apiFetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWithAuth(
  routes: Parameters<typeof createMemoryRouter>[0],
  initialEntries: string[],
) {
  const queryClient = createQueryClient();
  const router = createMemoryRouter(routes, { initialEntries });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

const me = (role: OrgRole) => ({
  user: { id: "u1", email: "me@example.com", name: "Me" },
  memberships: [{ slug: "acme", name: "Acme", role }],
  csrfToken: "csrf-1",
});

const summary = (
  envKey: string,
  over: Partial<FlagEnvConfigSummary> = {},
): FlagEnvConfigSummary => ({
  envKey,
  enabled: true,
  defaultVariation: false,
  ruleCount: 2,
  configVersion: 5,
  ...over,
});

const twoFlags: FlagWithEnvironments[] = [
  {
    key: "checkout",
    description: null,
    type: "boolean",
    archivedAt: null,
    createdAt: "2026-07-31T00:00:00.000Z",
    environments: [summary("development")],
  },
  {
    key: "legacy-flow",
    description: null,
    type: "boolean",
    archivedAt: "2026-07-30T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    environments: [summary("development", { enabled: false, ruleCount: 0, configVersion: 1 })],
  },
];

function mockApi(role: OrgRole, flags: FlagWithEnvironments[] = twoFlags) {
  apiFetchMock.mockImplementation((path: string) => {
    if (path === "/auth/me") return Promise.resolve(me(role));
    if (path === "/orgs/acme/projects/web/flags")
      return Promise.resolve({ flags: flags.filter((f) => f.archivedAt === null) });
    if (path === "/orgs/acme/projects/web/flags?includeArchived=true")
      return Promise.resolve({ flags });
    return Promise.resolve(undefined);
  });
}

const routes = [
  {
    path: "/orgs/:orgSlug/projects/:projectKey/environments/:envKey/flags",
    element: <FlagsListRoute />,
  },
];
const entry = ["/orgs/acme/projects/web/environments/development/flags"];

describe("FlagsListRoute", () => {
  it("renders the per-env summary columns for each flag", async () => {
    mockApi("admin");
    renderWithAuth(routes, entry);
    expect(await screen.findByText("checkout")).toBeInTheDocument();
    // enabled=On, default=false, rules=2, version=v5
    expect(screen.getByText("On")).toBeInTheDocument();
    expect(screen.getByText("false")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("v5")).toBeInTheDocument();
  });

  it("hides archived flags by default and reveals them via the toggle", async () => {
    mockApi("admin");
    renderWithAuth(routes, entry);
    expect(await screen.findByText("checkout")).toBeInTheDocument();
    expect(screen.queryByText("legacy-flow")).toBeNull();

    await userEvent.click(screen.getByLabelText("Show archived"));
    expect(await screen.findByText("legacy-flow")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("renders an empty state when there are no flags", async () => {
    mockApi("admin", []);
    renderWithAuth(routes, entry);
    expect(await screen.findByText("No flags yet.")).toBeInTheDocument();
  });

  it("renders a loading state before data arrives", async () => {
    const pending = Promise.withResolvers<unknown>();
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/auth/me") return Promise.resolve(me("admin"));
      return pending.promise;
    });
    renderWithAuth(routes, entry);
    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("renders an error state when the flags request fails", async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/auth/me") return Promise.resolve(me("admin"));
      return Promise.reject(new ApiError("LOST_OWL", "gone", 404));
    });
    renderWithAuth(routes, entry);
    expect(await screen.findByText("That item no longer exists.")).toBeInTheDocument();
  });
});
