import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-2 text-sm font-medium",
    isActive ? "bg-slate-200 text-slate-900" : "text-slate-600 hover:bg-slate-100",
  );

/** Persistent app shell: top bar + left nav + routed content outlet. */
export function RootLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <span className="text-lg font-semibold text-slate-900">togglr</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{user?.email ?? ""}</span>
          <Button variant="default">New flag</Button>
        </div>
      </header>
      <div className="flex flex-1">
        <nav aria-label="Primary" className="w-56 border-r border-slate-200 bg-white p-4">
          <ul className="flex flex-col gap-1">
            <li>
              <NavLink to="/" end className={navLinkClass}>
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings" className={navLinkClass}>
                Settings
              </NavLink>
            </li>
          </ul>
        </nav>
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
