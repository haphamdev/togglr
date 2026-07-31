import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { setCsrfToken } from "../api/csrf-store";
import { type AuthMeResponse, authMeQueryKey } from "../auth/use-auth-me";
import { Button } from "../components/ui/button";

/** Signup route: creates an account via POST /auth/signup and bootstraps the session. */
export function SignupRoute() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: (body: { email: string; password: string; name?: string }) =>
      // Bootstrap mutation: no CSRF token exists until the session is established.
      apiFetch<AuthMeResponse>("/auth/signup", { method: "POST", body, csrfExempt: true }),
    onSuccess: async (res) => {
      setCsrfToken(res.csrfToken);
      await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
      navigate("/");
    },
  });

  const errorMessage = toErrorMessage(mutation.error);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({ email, password, name: name || undefined });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Create your togglr account</h1>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="Your name (optional)"
            aria-label="Name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <input
            type="email"
            placeholder="you@example.com"
            aria-label="Email"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="Password (min 10 characters)"
            aria-label="Password"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={10}
            required
          />
          {errorMessage ? (
            <p role="alert" className="text-sm text-red-600">
              {errorMessage}
            </p>
          ) : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating account…" : "Sign up"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-slate-900 hover:underline">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

/** Map the API error to a user-facing message. */
function toErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) {
    if (error.code === "GREEDY_FOX") return "An account with this email already exists.";
    if (error.code === "CLUMSY_OWL") {
      return "Please enter a valid email and a password of at least 10 characters.";
    }
  }
  return "Something went wrong. Please try again.";
}
