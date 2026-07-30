import { Button } from "../components/ui/button";

/** Phase-1 login skeleton — the redirect target for unauthenticated users. */
export function LoginRoute() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Sign in to togglr</h1>
        <form className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="you@example.com"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            disabled
          />
          <input
            type="password"
            placeholder="Password"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            disabled
          />
          <Button type="button" disabled>
            Continue
          </Button>
        </form>
      </section>
    </main>
  );
}
