import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { getCsrfToken, setCsrfToken } from "../api/csrf-store";
import { createQueryClient } from "../app/query-client";
import { appRoutes } from "../app/router";
import { AuthProvider } from "./auth-context";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, apiFetch: apiFetchMock };
});

function renderApp(initialEntries: string[]) {
  const queryClient = createQueryClient();
  const router = createMemoryRouter(appRoutes, { initialEntries });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

const authMeOk = {
  user: { id: "u1", email: "ada@example.com", name: "Ada" },
  memberships: [{ slug: "acme", name: "Acme", role: "owner" }],
  csrfToken: "csrf-token-42",
};

let eventSourceMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setCsrfToken(null);
  apiFetchMock.mockReset();
  eventSourceMock = vi.fn();
  vi.stubGlobal("EventSource", eventSourceMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth bootstrap + routing", () => {
  it("redirects to /login on 401 SLEEPY_OWL", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("SLEEPY_OWL", "no session", 401));
    renderApp(["/"]);
    expect(await screen.findByText("Sign in to togglr")).toBeInTheDocument();
  });

  it("renders the authed shell and stores the CSRF token on 200", async () => {
    apiFetchMock.mockResolvedValue(authMeOk);
    renderApp(["/"]);
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    await waitFor(() => expect(getCsrfToken()).toBe("csrf-token-42"));
  });

  it("redirects a protected route to /login when there is no session", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("SLEEPY_OWL", "no session", 401));
    renderApp(["/settings"]);
    expect(await screen.findByText("Sign in to togglr")).toBeInTheDocument();
  });

  it("shows an explicit loading state while /auth/me is pending (never blank)", () => {
    apiFetchMock.mockReturnValue(Promise.withResolvers().promise);
    renderApp(["/"]);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it("shows an explicit error state on a non-401 failure (never blank)", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("DIZZY_OWL", "degraded", 503));
    renderApp(["/"]);
    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it("opens no SSE connection during bootstrap", async () => {
    apiFetchMock.mockResolvedValue(authMeOk);
    renderApp(["/"]);
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(eventSourceMock).not.toHaveBeenCalled();
  });
});
