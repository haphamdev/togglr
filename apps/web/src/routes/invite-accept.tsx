/** Public invite-accept route: previews an invite by token and joins the org. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InvitePreview } from "@togglr/shared-types";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { setCsrfToken } from "../api/csrf-store";
import { authMeQueryKey } from "../auth/use-auth-me";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { errorMessage } from "../org/error-messages";

interface AcceptResp {
  user: { id: string; email: string };
  membership: { slug: string; role: string };
  csrfToken?: string;
}

export function InviteAcceptRoute() {
  const { token } = useParams();
  const t = token as string;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");

  const preview = useQuery({
    queryKey: ["invite", t],
    queryFn: () => apiFetch<InvitePreview>(`/auth/invites/${t}`),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: (vars: { password?: string; csrfExempt: boolean }) =>
      apiFetch<AcceptResp>(`/auth/invites/${t}/accept`, {
        method: "POST",
        body: vars.password === undefined ? {} : { password: vars.password },
        csrfExempt: vars.csrfExempt,
      }),
    onSuccess: async (res, vars) => {
      if (vars.csrfExempt) setCsrfToken(res.csrfToken ?? null);
      await queryClient.invalidateQueries({ queryKey: authMeQueryKey });
      navigate(`/orgs/${res.membership.slug}`);
    },
  });

  const acceptSignedIn = accept.error instanceof ApiError && accept.error.code === "SLEEPY_OWL";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <Card className="w-full max-w-sm">
        {preview.isPending ? (
          <p role="status" className="text-sm text-slate-500">
            Loading…
          </p>
        ) : preview.isError ? (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage(preview.error)}
          </p>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Join {preview.data.orgName}</CardTitle>
            </CardHeader>
            <p className="mb-4 text-sm text-slate-600">
              You've been invited to join {preview.data.orgName} as {preview.data.role}.
            </p>
            <p className="mb-6 text-sm text-slate-500">Invited email: {preview.data.email}</p>
            {preview.data.userExists ? (
              <div className="flex flex-col gap-4">
                <Button
                  type="button"
                  disabled={accept.isPending}
                  onClick={() => accept.mutate({ csrfExempt: false })}
                >
                  {accept.isPending ? "Joining…" : `Accept as ${preview.data.email}`}
                </Button>
                {acceptSignedIn ? (
                  <p role="alert" className="text-sm text-red-600">
                    Please{" "}
                    <Link
                      to={`/login?next=/invite/${t}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      sign in
                    </Link>{" "}
                    to accept this invite.
                  </p>
                ) : accept.error ? (
                  <p role="alert" className="text-sm text-red-600">
                    {errorMessage(accept.error)}
                  </p>
                ) : null}
              </div>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  accept.mutate({ password, csrfExempt: true });
                }}
              >
                <Input
                  type="password"
                  placeholder="Password"
                  aria-label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                {accept.error ? (
                  <p role="alert" className="text-sm text-red-600">
                    {errorMessage(accept.error)}
                  </p>
                ) : null}
                <Button type="submit" disabled={accept.isPending}>
                  {accept.isPending ? "Joining…" : "Create account & join"}
                </Button>
              </form>
            )}
          </>
        )}
      </Card>
    </main>
  );
}
