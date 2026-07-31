import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OrgRole } from "@togglr/shared-types";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCsrfToken } from "../api/csrf-store";
import { createQueryClient } from "../app/query-client";
import { AuthProvider } from "../auth/auth-context";
import { EnvironmentKeysRoute } from "./environment-keys";
import { OrgMembersRoute } from "./org-members";
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

const oneMember = {
  members: [
    {
      userId: "u2",
      email: "a@b.com",
      name: "A",
      role: "admin",
      createdAt: "2026-07-31T00:00:00.000Z",
    },
  ],
};

describe("OrgMembersRoute role gating", () => {
  it("is read-only for non-owners (no Select, no Remove)", async () => {
    apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/auth/me") return Promise.resolve(me("member"));
      if (path === "/orgs/acme/members" && !options?.method) return Promise.resolve(oneMember);
      if (path === "/orgs/acme/invites" && !options?.method)
        return Promise.resolve({ invites: [] });
      return Promise.resolve(undefined);
    });
    renderWithAuth(
      [{ path: "/orgs/:orgSlug/members", element: <OrgMembersRoute /> }],
      ["/orgs/acme/members"],
    );
    expect(await screen.findByText("a@b.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("Role for a@b.com")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.getByRole("cell", { name: "admin" })).toBeInTheDocument();
  });

  it("shows interactive controls for owners", async () => {
    apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/auth/me") return Promise.resolve(me("owner"));
      if (path === "/orgs/acme/members" && !options?.method) return Promise.resolve(oneMember);
      if (path === "/orgs/acme/invites" && !options?.method)
        return Promise.resolve({ invites: [] });
      return Promise.resolve(undefined);
    });
    renderWithAuth(
      [{ path: "/orgs/:orgSlug/members", element: <OrgMembersRoute /> }],
      ["/orgs/acme/members"],
    );
    expect(await screen.findByLabelText("Role for a@b.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });
});

describe("ProjectEnvironmentsRoute project rename", () => {
  it("sends PATCH { name } when an admin renames the project", async () => {
    apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/auth/me") return Promise.resolve(me("admin"));
      if (path === "/orgs/acme/projects/web" && !options?.method)
        return Promise.resolve({
          project: { key: "web", name: "Web", createdAt: "2026-07-31T00:00:00.000Z" },
        });
      if (path === "/orgs/acme/projects/web/environments" && !options?.method)
        return Promise.resolve({ environments: [] });
      if (path === "/orgs/acme/projects/web" && options?.method === "PATCH")
        return Promise.resolve({
          project: { key: "web", name: "Web App", createdAt: "2026-07-31T00:00:00.000Z" },
        });
      return Promise.resolve(undefined);
    });
    renderWithAuth(
      [{ path: "/orgs/:orgSlug/projects/:projectKey", element: <ProjectEnvironmentsRoute /> }],
      ["/orgs/acme/projects/web"],
    );
    const input = await screen.findByLabelText("Project name");
    await userEvent.clear(input);
    await userEvent.type(input, "Web App");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/orgs/acme/projects/web", {
        method: "PATCH",
        body: { name: "Web App" },
      }),
    );
  });

  it("hides the settings card from non-admin members", async () => {
    apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/auth/me") return Promise.resolve(me("member"));
      if (path === "/orgs/acme/projects/web/environments" && !options?.method)
        return Promise.resolve({ environments: [] });
      return Promise.resolve(undefined);
    });
    renderWithAuth(
      [{ path: "/orgs/:orgSlug/projects/:projectKey", element: <ProjectEnvironmentsRoute /> }],
      ["/orgs/acme/projects/web"],
    );
    expect(await screen.findByText("Environments")).toBeInTheDocument();
    expect(screen.queryByLabelText("Project name")).toBeNull();
  });
});

describe("EnvironmentKeysRoute environment rename", () => {
  it("sends PATCH { name } when an admin renames the environment", async () => {
    apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/auth/me") return Promise.resolve(me("admin"));
      if (path === "/orgs/acme/projects/web/environments/prod" && !options?.method)
        return Promise.resolve({
          environment: {
            key: "prod",
            name: "Production",
            rulesetVersion: 1,
            createdAt: "2026-07-31T00:00:00.000Z",
          },
        });
      if (path === "/orgs/acme/projects/web/environments/prod/keys" && !options?.method)
        return Promise.resolve({ keys: [] });
      if (path === "/orgs/acme/projects/web/environments/prod" && options?.method === "PATCH")
        return Promise.resolve({
          environment: {
            key: "prod",
            name: "Prod",
            rulesetVersion: 1,
            createdAt: "2026-07-31T00:00:00.000Z",
          },
        });
      return Promise.resolve(undefined);
    });
    renderWithAuth(
      [
        {
          path: "/orgs/:orgSlug/projects/:projectKey/environments/:envKey",
          element: <EnvironmentKeysRoute />,
        },
      ],
      ["/orgs/acme/projects/web/environments/prod"],
    );
    const input = await screen.findByLabelText("Environment name");
    await userEvent.clear(input);
    await userEvent.type(input, "Prod");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/orgs/acme/projects/web/environments/prod", {
        method: "PATCH",
        body: { name: "Prod" },
      }),
    );
  });
});
