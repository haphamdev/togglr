/** Org projects route: lists projects for the current org and creates new ones. */
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { errorMessage } from "../org/error-messages";
import { useCreateProject, useProjects } from "../org/use-projects";

export function OrgProjectsRoute() {
  const { orgSlug } = useParams();
  const slug = orgSlug as string;
  const projects = useProjects(slug);
  const create = useCreateProject(slug);
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        {projects.isPending ? (
          <p role="status" className="text-sm text-slate-500">
            Loading…
          </p>
        ) : projects.isError ? (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage(projects.error)}
          </p>
        ) : projects.data.projects.length === 0 ? (
          <p className="text-sm text-slate-500">No projects yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.data.projects.map((project) => (
              <li key={project.key}>
                <Link
                  to={`/orgs/${slug}/projects/${project.key}`}
                  className="flex flex-col rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-900">{project.name}</span>
                  <span className="text-xs text-slate-500">{project.key}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create project</CardTitle>
        </CardHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Input
            aria-label="Project key"
            placeholder="checkout"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            required
          />
          <Input
            aria-label="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {createError ? (
            <p role="alert" className="text-sm text-red-600">
              {createError}
            </p>
          ) : null}
          <Button type="submit" disabled={create.isPending}>
            Create project
          </Button>
          <p className="text-xs text-slate-500">
            Creating a project seeds development, staging, and production environments.
          </p>
        </form>
      </Card>
    </div>
  );
}
