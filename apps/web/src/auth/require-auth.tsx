import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth-context";

/**
 * Gates protected routes. Loading → explicit spinner (never blank); 401 →
 * redirect to /login (covers AC2 no-session + AC4 expired session); non-401
 * error → explicit error state with retry.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, errorMessage, retry } = useAuth();

  if (status === "loading") {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center text-slate-500">
        Loading your workspace…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 text-slate-700"
      >
        <p>Couldn’t load your session: {errorMessage}</p>
        <button
          type="button"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          onClick={retry}
        >
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
