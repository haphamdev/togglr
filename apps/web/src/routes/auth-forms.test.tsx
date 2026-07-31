import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { getCsrfToken, setCsrfToken } from "../api/csrf-store";
import { createQueryClient } from "../app/query-client";
import { appRoutes } from "../app/router";
import { AuthProvider } from "../auth/auth-context";
import { authMeQueryKey } from "../auth/use-auth-me";
import { LoginRoute } from "./login";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return { ...actual, apiFetch: apiFetchMock };
});

const authMeOk = {
  user: { id: "u1", email: "ada@example.com", name: "Ada" },
  memberships: [],
  csrfToken: "csrf-token-42",
};

beforeEach(() => {
  setCsrfToken(null);
  apiFetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginRoute", () => {
  function renderLogin() {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const router = createMemoryRouter(
      [
        { path: "/login", element: <LoginRoute /> },
        { path: "/", element: <div>HOME PAGE</div> },
      ],
      { initialEntries: ["/login"] },
    );
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    return { invalidateSpy };
  }

  it("submits credentials csrf-exempt, stores the token, invalidates auth-me, lands on /", async () => {
    apiFetchMock.mockResolvedValue(authMeOk);
    const { invalidateSpy } = renderLogin();

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: { email: "ada@example.com", password: "correct-horse" },
      csrfExempt: true,
    });
    await waitFor(() => expect(getCsrfToken()).toBe("csrf-token-42"));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: authMeQueryKey });
    expect(await screen.findByText("HOME PAGE")).toBeInTheDocument();
  });

  it("renders the generic error on a 401 SLY_FOX", async () => {
    apiFetchMock.mockRejectedValue(new ApiError("SLY_FOX", "nope", 401));
    renderLogin();

    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid email or password.");
  });
});

describe("Logout control (RootLayout)", () => {
  let eventSourceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventSourceMock = vi.fn();
    vi.stubGlobal("EventSource", eventSourceMock);
  });

  it("posts /auth/logout, clears the CSRF token, and lands on /login", async () => {
    let loggedOut = false;
    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/auth/logout") {
        loggedOut = true;
        return Promise.resolve(undefined);
      }
      if (path === "/auth/me") {
        return loggedOut
          ? Promise.reject(new ApiError("SLEEPY_OWL", "no session", 401))
          : Promise.resolve(authMeOk);
      }
      return Promise.resolve(undefined);
    });

    const queryClient = createQueryClient();
    const router = createMemoryRouter(appRoutes, { initialEntries: ["/"] });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>,
    );

    // Authenticated shell renders with the logout control.
    const logoutButton = await screen.findByRole("button", { name: "Log out" });
    await userEvent.click(logoutButton);

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/auth/logout", { method: "POST" }),
    );
    await waitFor(() => expect(getCsrfToken()).toBeNull());
    expect(await screen.findByText("Sign in to togglr")).toBeInTheDocument();
  });
});
