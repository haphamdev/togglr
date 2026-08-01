import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OrgRole } from "@togglr/shared-types";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { setCsrfToken } from "../api/csrf-store";
import { createQueryClient } from "../app/query-client";
import { AuthProvider } from "../auth/auth-context";
import { FlagEditorRoute } from "./flag-editor";

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

const CONFIG_PATH = "/orgs/acme/projects/web/flags/checkout/environments/production/config";
const PREVIEW_PATH = "/orgs/acme/projects/web/flags/checkout/environments/production/preview";

const baseRule = {
  conditions: [{ attribute: "country", operator: "in", values: ["US"] }],
  result: { kind: "variation", variation: true },
};
const baseConfig = {
  enabled: true,
  defaultVariation: false,
  rules: [baseRule],
  configVersion: 4,
  updatedAt: "2026-07-31T00:00:00.000Z",
};

const routes = [
  {
    path: "/orgs/:orgSlug/projects/:projectKey/environments/:envKey/flags/:flagKey",
    element: <FlagEditorRoute />,
  },
];
const entry = ["/orgs/acme/projects/web/environments/production/flags/checkout"];

/** Happy-path mock: GET config, PATCH bumps to v5, POST preview → RULE_MATCH. */
function defaultMock(role: OrgRole) {
  apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === "/auth/me") return Promise.resolve(me(role));
    if (path === CONFIG_PATH && options?.method === "PATCH")
      return Promise.resolve({ config: { ...baseConfig, configVersion: 5, rulesetVersion: 9 } });
    if (path === CONFIG_PATH) return Promise.resolve({ config: baseConfig });
    if (path === PREVIEW_PATH && options?.method === "POST")
      return Promise.resolve({ value: true, reason: "RULE_MATCH" });
    return Promise.resolve(undefined);
  });
}

describe("FlagEditorRoute", () => {
  it("loads config into an editable form for admins", async () => {
    defaultMock("admin");
    renderWithAuth(routes, entry);
    const enabled = await screen.findByLabelText("Enabled");
    expect(enabled).toBeChecked();
    await waitFor(() => expect(enabled).toBeEnabled());
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("saves the draft with expectedConfigVersion and edited fields", async () => {
    defaultMock("admin");
    renderWithAuth(routes, entry);
    const enabled = await screen.findByLabelText("Enabled");
    await waitFor(() => expect(enabled).toBeEnabled());
    await userEvent.click(enabled); // toggle enabled -> false
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(CONFIG_PATH, {
        method: "PATCH",
        body: {
          expectedConfigVersion: 4,
          enabled: false,
          defaultVariation: false,
          rules: [baseRule],
        },
      }),
    );
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("clamps rollout percentage to 0..100 and defaults bucketBy to key", async () => {
    defaultMock("admin");
    renderWithAuth(routes, entry);
    await screen.findByLabelText("Enabled");
    await userEvent.selectOptions(screen.getByLabelText("Rule 1 result kind"), "rollout");
    expect(screen.getByLabelText("Rule 1 bucket by")).toHaveValue("key");
    const pct = screen.getByLabelText("Rule 1 percentage");
    fireEvent.change(pct, { target: { value: "150" } });
    expect(pct).toHaveValue(100);
    fireEvent.change(pct, { target: { value: "-5" } });
    expect(pct).toHaveValue(0);
  });

  it("shows an inline rule error (not a global banner) on CURIOUS_CAT", async () => {
    apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/auth/me") return Promise.resolve(me("admin"));
      if (path === CONFIG_PATH && options?.method === "PATCH")
        return Promise.reject(new ApiError("CURIOUS_CAT", "bad rules", 400));
      if (path === CONFIG_PATH) return Promise.resolve({ config: baseConfig });
      return Promise.resolve(undefined);
    });
    renderWithAuth(routes, entry);
    await screen.findByLabelText("Enabled");
    // Edit rule 1 so it becomes the "last edited" (and thus offending) rule.
    await userEvent.selectOptions(screen.getByLabelText("Rule 1 variation"), "false");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/This rule is invalid/)).toBeInTheDocument();
    // No global banner (errorMessage(CURIOUS_CAT) would render "Something went wrong.").
    expect(screen.queryByText("Something went wrong.")).toBeNull();
  });

  it("refetches config, shows a conflict notice, and retains edits on JEALOUS_CAT", async () => {
    const getConfigCalls = () =>
      apiFetchMock.mock.calls.filter(
        (c) => c[0] === CONFIG_PATH && !(c[1] as { method?: string } | undefined)?.method,
      ).length;
    apiFetchMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/auth/me") return Promise.resolve(me("admin"));
      if (path === CONFIG_PATH && options?.method === "PATCH")
        return Promise.reject(new ApiError("JEALOUS_CAT", "stale", 409));
      // The rebased base advertises a newer version, which becomes the next expectedConfigVersion.
      if (path === CONFIG_PATH)
        return Promise.resolve({ config: { ...baseConfig, configVersion: 7 } });
      return Promise.resolve(undefined);
    });
    renderWithAuth(routes, entry);
    const enabled = await screen.findByLabelText("Enabled");
    await waitFor(() => expect(enabled).toBeEnabled());
    await userEvent.click(enabled); // edit -> enabled false
    const before = getConfigCalls();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/changed since you loaded it/)).toBeInTheDocument();
    // The stale save triggered a refetch of the current base...
    await waitFor(() => expect(getConfigCalls()).toBeGreaterThan(before));
    // ...and the user's in-progress edit is preserved to reapply onto it.
    expect(screen.getByLabelText("Enabled")).not.toBeChecked();
  });

  it("runs preview with the current draft and renders value + reason", async () => {
    defaultMock("admin");
    renderWithAuth(routes, entry);
    await screen.findByLabelText("Enabled");
    await userEvent.type(screen.getByLabelText("Context key"), "u1");
    await userEvent.click(screen.getByRole("button", { name: "Run preview" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(PREVIEW_PATH, {
        method: "POST",
        body: {
          context: { key: "u1" },
          defaultValue: false,
          config: { enabled: true, defaultVariation: false, rules: [baseRule] },
        },
      }),
    );
    const status = await screen.findByRole("status");
    expect(within(status).getByText("RULE_MATCH")).toBeInTheDocument();
    expect(within(status).getByText("true")).toBeInTheDocument();
  });

  it("renders read-only for members (Save disabled) but preview still works", async () => {
    defaultMock("member");
    renderWithAuth(routes, entry);
    const enabled = await screen.findByLabelText("Enabled");
    await waitFor(() => expect(enabled).toBeDisabled());
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    // Preview remains available to members.
    await userEvent.click(screen.getByRole("button", { name: "Run preview" }));
    expect(await screen.findByText("RULE_MATCH")).toBeInTheDocument();
  });
});
