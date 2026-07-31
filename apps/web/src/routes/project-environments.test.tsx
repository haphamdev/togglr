import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OrgRole } from "@togglr/shared-types";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCsrfToken } from "../api/csrf-store";
import { createQueryClient } from "../app/query-client";
import { AuthProvider } from "../auth/auth-context";
import { ProjectEnvironmentsRoute } from "./project-environments";

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

const project = {
  project: { key: "web", name: "Web", createdAt: "2026-07-31T00:00:00.000Z" },
};

const twoEnvs = {
  environments: [
    {
      key: "prod",
      name: "Production",
      rulesetVersion: 1,
      archivedAt: null,
      createdAt: "2026-07-31T00:00:00.000Z",
    },
    {
      key: "legacy",
      name: "Legacy",
      rulesetVersion: 3,
      archivedAt: "2026-07-30T00:00:00.000Z",
      createdAt: "2026-07-01T00:00:00.000Z",
    },
  ],
};

function mockApi(role: OrgRole) {
  apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === "/auth/me") return Promise.resolve(me(role));
    if (path === "/orgs/acme/projects/web" && !options?.method) return Promise.resolve(project);
    if (path === "/orgs/acme/projects/web/environments" && !options?.method)
      return Promise.resolve(twoEnvs);
    if (path.startsWith("/orgs/acme/projects/web/environments/") && options?.method === "PATCH")
      return Promise.resolve({ environment: twoEnvs.environments[0] });
    return Promise.resolve(undefined);
  });
}

const routes = [
  { path: "/orgs/:orgSlug/projects/:projectKey", element: <ProjectEnvironmentsRoute /> },
];
const entry = ["/orgs/acme/projects/web"];

describe("ProjectEnvironmentsRoute archive/restore", () => {
  it("hides archived envs by default and reveals them via the toggle", async () => {
    mockApi("admin");
    renderWithAuth(routes, entry);
    expect(await screen.findByText("Production")).toBeInTheDocument();
    expect(screen.queryByText("Legacy")).toBeNull();

    await userEvent.click(screen.getByLabelText("Show archived"));
    expect(await screen.findByText("Legacy")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("sends PATCH { archived: true } when archiving an active env", async () => {
    mockApi("admin");
    renderWithAuth(routes, entry);
    await screen.findByText("Production");
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/orgs/acme/projects/web/environments/prod", {
        method: "PATCH",
        body: { archived: true },
      }),
    );
    expect(await screen.findByText("Environment archived.")).toBeInTheDocument();
  });

  it("sends PATCH { archived: false } when restoring an archived env", async () => {
    mockApi("admin");
    renderWithAuth(routes, entry);
    await screen.findByText("Production");
    await userEvent.click(screen.getByLabelText("Show archived"));
    await userEvent.click(await screen.findByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/orgs/acme/projects/web/environments/legacy", {
        method: "PATCH",
        body: { archived: false },
      }),
    );
  });

  it("hides archive/restore controls from members", async () => {
    mockApi("member");
    renderWithAuth(routes, entry);
    expect(await screen.findByText("Production")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
  });
});
