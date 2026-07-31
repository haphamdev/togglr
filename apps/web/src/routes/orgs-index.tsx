/** Orgs index route: lists the user's organizations and creates a new one. */
import { type FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { errorMessage } from "../org/error-messages";
import { useCreateOrg, useOrgs } from "../org/use-orgs";

export function OrgsIndexRoute() {
  const orgs = useOrgs();
  const create = useCreateOrg();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(
      { name, slug },
      {
        onSuccess: () => {
          setName("");
          setSlug("");
        },
      },
    );
  };

  if (orgs.isPending) {
    return (
      <p role="status" className="text-sm text-slate-500">
        Loading…
      </p>
    );
  }

  if (orgs.isError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {errorMessage(orgs.error)}
      </p>
    );
  }

  if (orgs.data.orgs.length === 1) {
    return <Navigate to={`/orgs/${orgs.data.orgs[0].slug}`} replace />;
  }

  const createError = errorMessage(create.error);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Your organizations</h1>
      <ul className="flex flex-col gap-3">
        {orgs.data.orgs.map((org) => (
          <li key={org.slug}>
            <Link to={`/orgs/${org.slug}`} className="block">
              <Card className="flex items-center justify-between hover:border-slate-300">
                <span className="font-medium text-slate-900">{org.name}</span>
                <span className="text-sm text-slate-500">{org.role}</span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <Card>
        <CardHeader>
          <CardTitle>Create organization</CardTitle>
        </CardHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              aria-label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              aria-label="Slug"
              placeholder="acme-inc"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>
          {createError ? (
            <p role="alert" className="text-sm text-red-600">
              {createError}
            </p>
          ) : null}
          <Button type="submit" disabled={create.isPending}>
            Create organization
          </Button>
        </form>
      </Card>
    </main>
  );
}
