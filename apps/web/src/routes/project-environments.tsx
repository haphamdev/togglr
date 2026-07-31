/** Project environments route: lists environments for a project and creates new ones. */
import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOrgRole } from "../auth/auth-context";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../components/ui/table";
import { errorMessage } from "../org/error-messages";
import {
  useArchiveEnvironment,
  useCreateEnvironment,
  useEnvironments,
} from "../org/use-environments";
import { useProject, useRenameProject } from "../org/use-projects";

export function ProjectEnvironmentsRoute() {
  const { orgSlug, projectKey } = useParams();
  const slug = orgSlug as string;
  const pk = projectKey as string;

  const callerRole = useOrgRole(slug);
  const canManage = callerRole === "owner" || callerRole === "admin";
  const projectQuery = useProject(slug, pk, { enabled: canManage });
  const rename = useRenameProject(slug, pk);
  const project = projectQuery.data?.project;
  const [renameName, setRenameName] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (project) setRenameName(project.name);
  }, [project]);

  const onRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    rename.mutate({ name: renameName }, { onSuccess: () => setSaved(true) });
  };
  const renameError = errorMessage(rename.error);

  const environments = useEnvironments(slug, pk);
  const create = useCreateEnvironment(slug, pk);

  const [showArchived, setShowArchived] = useState(false);
  const archive = useArchiveEnvironment(slug, pk);
  const archiveError = errorMessage(archive.error);

  const [key, setKey] = useState("");
  const [name, setName] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(
      { key, name },
      {
        onSuccess: () => {
          setKey("");
          setName("");
        },
      },
    );
  };

  const createError = errorMessage(create.error);

  return (
    <div className="flex flex-col gap-6">
      {canManage && project ? (
        <Card>
          <CardHeader>
            <CardTitle>Project settings</CardTitle>
          </CardHeader>
          <form className="flex flex-col gap-3" onSubmit={onRename}>
            <div className="flex flex-col gap-1">
              <Label htmlFor="project-key">Key</Label>
              <Input id="project-key" value={project.key} readOnly disabled />
              <p className="text-xs text-slate-500">The key is permanent and can't be changed.</p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                aria-label="Project name"
                value={renameName}
                onChange={(e) => {
                  setRenameName(e.target.value);
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
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Environments</CardTitle>
        </CardHeader>
        <label className="flex items-center gap-2 px-1 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />{" "}
          Show archived
        </label>
        {archiveError ? (
          <p role="alert" className="text-sm text-red-600">
            {archiveError}
          </p>
        ) : null}
        {archive.isSuccess ? (
          <p role="status" className="text-sm text-green-600">
            {archive.variables.archived ? "Environment archived." : "Environment restored."}
          </p>
        ) : null}
        {environments.isPending ? (
          <p role="status" className="text-sm text-slate-500">
            Loading…
          </p>
        ) : environments.isError ? (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage(environments.error)}
          </p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Key</TableHeaderCell>
                <TableHeaderCell>Version</TableHeaderCell>
                {canManage ? <TableHeaderCell>Actions</TableHeaderCell> : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {(showArchived
                ? environments.data.environments
                : environments.data.environments.filter((e) => e.archivedAt === null)
              ).map((env) => (
                <TableRow key={env.key} className={env.archivedAt ? "opacity-60" : undefined}>
                  <TableCell>
                    <Link
                      to={`/orgs/${slug}/projects/${pk}/environments/${env.key}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {env.name}
                    </Link>
                    {env.archivedAt ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                        Archived
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{env.key}</TableCell>
                  <TableCell>v{env.rulesetVersion}</TableCell>
                  {canManage ? (
                    <TableCell>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          archive.mutate({ envKey: env.key, archived: env.archivedAt === null })
                        }
                      >
                        {env.archivedAt ? "Restore" : "Archive"}
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create environment</CardTitle>
        </CardHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="environment-key">Key</Label>
            <Input
              id="environment-key"
              aria-label="Environment key"
              placeholder="canary"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="environment-name">Name</Label>
            <Input
              id="environment-name"
              aria-label="Environment name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {createError ? (
            <p role="alert" className="text-sm text-red-600">
              {createError}
            </p>
          ) : null}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create environment"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
