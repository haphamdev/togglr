import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { setCsrfToken } from "../api/csrf-store";
import { useAuth } from "../auth/auth-context";
import { authMeQueryKey } from "../auth/use-auth-me";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { cn } from "../lib/utils";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "block rounded-md px-3 py-2 text-sm font-medium",
    isActive ? "bg-slate-200 text-slate-900" : "text-slate-600 hover:bg-slate-100",
  );

/** Persistent app shell: top bar (org switcher + logout) + left nav + outlet. */
export function RootLayout() {
  const { user, memberships } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgSlug } = useParams();

  const logout = useMutation({
    // Authenticated mutation: the CSRF token is in the store, so NOT csrfExempt.
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      setCsrfToken(null);
      await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
      navigate("/login");
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <span className="text-lg font-semibold text-slate-900">togglr</span>
        <div className="flex items-center gap-3">
          {memberships.length > 0 ? (
            <Select
              aria-label="Organization"
              value={orgSlug ?? ""}
              onChange={(e) => {
                if (e.target.value) navigate(`/orgs/${e.target.value}`);
              }}
            >
              <option value="" disabled>
                Select organization…
              </option>
              {memberships.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </Select>
          ) : null}
          <span className="text-sm text-slate-500">{user?.email ?? ""}</span>
          <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
            {logout.isPending ? "Logging out…" : "Log out"}
          </Button>
        </div>
      </header>
      <div className="flex flex-1">
        <nav aria-label="Primary" className="w-56 border-r border-slate-200 bg-white p-4">
          <ul className="flex flex-col gap-1">
            <li>
              <NavLink to="/" end className={navLinkClass}>
                Organizations
              </NavLink>
            </li>
            {orgSlug ? (
              <>
                <li>
                  <NavLink to={`/orgs/${orgSlug}`} end className={navLinkClass}>
                    Projects
                  </NavLink>
                </li>
                <li>
                  <NavLink to={`/orgs/${orgSlug}/members`} className={navLinkClass}>
                    Members
                  </NavLink>
                </li>
                <li>
                  <NavLink to={`/orgs/${orgSlug}/settings`} className={navLinkClass}>
                    Settings
                  </NavLink>
                </li>
              </>
            ) : null}
          </ul>
        </nav>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
