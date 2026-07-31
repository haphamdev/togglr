import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCsrfToken, setCsrfToken } from "../api/csrf-store";
import { createQueryClient } from "../app/query-client";
import { InviteAcceptRoute } from "./invite-accept";
import { OrgsIndexRoute } from "./orgs-index";

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

function renderAt(routes: Parameters<typeof createMemoryRouter>[0], initialEntries: string[]) {
  const queryClient = createQueryClient();
  const router = createMemoryRouter(routes, { initialEntries });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("OrgsIndexRoute create form", () => {
  it("creates an org, sending name + slug to POST /orgs", async () => {
    apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/orgs" && !options?.method) return Promise.resolve({ orgs: [] });
      if (path === "/orgs" && options?.method === "POST") {
        return Promise.resolve({
          org: {
            slug: "acme-inc",
            name: "Acme Inc",
            role: "owner",
            createdAt: "2026-07-31T00:00:00.000Z",
          },
        });
      }
      return Promise.resolve(undefined);
    });

    renderAt(
      [
        { path: "/", element: <OrgsIndexRoute /> },
        { path: "/orgs/:slug", element: <div>ORG PAGE</div> },
      ],
      ["/"],
    );

    await userEvent.type(await screen.findByLabelText("Name"), "Acme Inc");
    await userEvent.type(screen.getByLabelText("Slug"), "acme-inc");
    await userEvent.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/orgs", {
        method: "POST",
        body: { name: "Acme Inc", slug: "acme-inc" },
      }),
    );
  });
});

describe("InviteAcceptRoute new-account path", () => {
  it("creates the account (csrf-exempt), stores the returned CSRF, and joins the org", async () => {
    apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/auth/invites/tok123" && !options?.method) {
        return Promise.resolve({
          orgName: "Acme",
          email: "grace@example.com",
          role: "admin",
          userExists: false,
          expiresAt: "2026-08-04T10:00:00.000Z",
        });
      }
      if (path === "/auth/invites/tok123/accept" && options?.method === "POST") {
        return Promise.resolve({
          user: { id: "u9", email: "grace@example.com" },
          membership: { slug: "acme", role: "admin" },
          csrfToken: "new-csrf",
        });
      }
      return Promise.resolve(undefined);
    });

    renderAt(
      [
        { path: "/invite/:token", element: <InviteAcceptRoute /> },
        { path: "/orgs/:slug", element: <div>ORG PAGE</div> },
      ],
      ["/invite/tok123"],
    );

    await userEvent.type(await screen.findByLabelText("Password"), "hunter2pass");
    await userEvent.click(screen.getByRole("button", { name: "Create account & join" }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/auth/invites/tok123/accept", {
        method: "POST",
        body: { password: "hunter2pass" },
        csrfExempt: true,
      }),
    );
    await waitFor(() => expect(getCsrfToken()).toBe("new-csrf"));
    expect(await screen.findByText("ORG PAGE")).toBeInTheDocument();
  });
});
