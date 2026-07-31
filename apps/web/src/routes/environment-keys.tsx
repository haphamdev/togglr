/** Environment SDK keys route: issue, rotate, and revoke per-environment SDK keys. */
import type { SdkKeySecret } from "@togglr/shared-types";
import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../components/ui/table";
import { errorMessage } from "../org/error-messages";
import { useIssueKey, useRevokeKey, useRotateKey, useSdkKeys } from "../org/use-sdk-keys";

export function EnvironmentKeysRoute() {
  const { orgSlug, projectKey, envKey } = useParams();
  const slug = orgSlug as string;
  const pk = projectKey as string;
  const ek = envKey as string;

  const keys = useSdkKeys(slug, pk, ek);
  const issue = useIssueKey(slug, pk, ek);
  const rotate = useRotateKey(slug, pk, ek);
  const revoke = useRevokeKey(slug, pk, ek);

  const [name, setName] = useState("");
  const [shownSecret, setShownSecret] = useState<SdkKeySecret | null>(null);

  const onIssue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    issue.mutate(
      { name: name.trim() ? name.trim() : undefined },
      {
        onSuccess: (secret) => {
          setShownSecret(secret);
          setName("");
        },
      },
    );
  };

  const onRotate = (keyId: string) => {
    rotate.mutate(keyId, {
      onSuccess: (data) => setShownSecret(data.newKey),
    });
  };

  const listError = keys.isError ? errorMessage(keys.error) : null;
  const rotateError = errorMessage(rotate.error);
  const revokeError = errorMessage(revoke.error);
  const issueError = errorMessage(issue.error);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>SDK keys</CardTitle>
        </CardHeader>
        {keys.isPending ? (
          <p role="status" className="text-sm text-slate-500">
            Loading…
          </p>
        ) : listError ? (
          <p role="alert" className="text-sm text-red-600">
            {listError}
          </p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Prefix</TableHeaderCell>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Last used</TableHeaderCell>
                <TableHeaderCell>Expires</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(keys.data?.keys ?? []).map((key) => (
                <TableRow key={key.id}>
                  <TableCell>
                    <code className="font-mono">{key.prefix}</code>
                  </TableCell>
                  <TableCell>{key.name ?? "—"}</TableCell>
                  <TableCell>{key.status}</TableCell>
                  <TableCell>{key.lastUsedAt ?? "—"}</TableCell>
                  <TableCell>{key.expiresAt ?? "—"}</TableCell>
                  <TableCell>
                    {key.status === "active" ? (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => onRotate(key.id)}
                          disabled={rotate.isPending}
                        >
                          Rotate
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => revoke.mutate(key.id)}
                          disabled={revoke.isPending}
                        >
                          Revoke
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {rotateError ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {rotateError}
          </p>
        ) : null}
        {revokeError ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {revokeError}
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issue a new key</CardTitle>
        </CardHeader>
        <form className="flex items-end gap-3" onSubmit={onIssue}>
          <Input
            aria-label="Key name"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" disabled={issue.isPending}>
            {issue.isPending ? "Issuing…" : "Issue key"}
          </Button>
        </form>
        {issueError ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {issueError}
          </p>
        ) : null}
      </Card>

      <Dialog
        open={shownSecret !== null}
        onClose={() => setShownSecret(null)}
        title="Copy your SDK key"
      >
        <p className="mb-3 text-sm text-slate-600">
          This key is shown only once. Copy it now and store it securely.
        </p>
        <pre className="overflow-x-auto rounded-md bg-slate-100 p-3 text-sm">
          <code className="font-mono text-slate-900">{shownSecret?.secret}</code>
        </pre>
      </Dialog>
    </div>
  );
}
