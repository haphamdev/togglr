/** Org settings route: shows the immutable slug and an owner-only rename form. */
import { type FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { errorMessage } from "../org/error-messages";
import { useOrg, useRenameOrg } from "../org/use-orgs";

export function OrgSettingsRoute() {
  const slug = useParams().orgSlug as string;
  const orgQuery = useOrg(slug);
  const rename = useRenameOrg(slug);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  const org = orgQuery.data?.org;

  useEffect(() => {
    if (org) setName(org.name);
  }, [org]);

  if (orgQuery.isPending) {
    return (
      <p role="status" className="text-sm text-slate-500">
        Loading…
      </p>
    );
  }

  if (orgQuery.isError || !org) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {errorMessage(orgQuery.error)}
      </p>
    );
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    rename.mutate({ name }, { onSuccess: () => setSaved(true) });
  };

  const renameError = errorMessage(rename.error);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization settings</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="org-slug">Slug</Label>
          <Input id="org-slug" value={org.slug} readOnly disabled />
          <p className="text-xs text-slate-500">The slug is permanent and can't be changed.</p>
        </div>
        {org.role === "owner" ? (
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <div className="flex flex-col gap-1">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                aria-label="Organization name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
              />
            </div>
            {renameError ? (
              <p role="alert" className="text-sm text-red-600">
                {renameError}
              </p>
            ) : null}
            {saved ? (
              <p role="status" className="text-sm text-green-600">
                Saved.
              </p>
            ) : null}
            <Button type="submit" disabled={rename.isPending}>
              {rename.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-slate-500">
            Only organization owners can rename this organization.
          </p>
        )}
      </div>
    </Card>
  );
}
