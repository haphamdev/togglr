/** Flags list route: lists a project's flags with their per-environment config summary. */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../components/ui/table";
import { useFlags } from "../flags/use-flags";
import { errorMessage } from "../org/error-messages";

export function FlagsListRoute() {
  const { orgSlug, projectKey, envKey } = useParams();
  const slug = orgSlug as string;
  const pk = projectKey as string;
  const env = envKey as string;

  const [showArchived, setShowArchived] = useState(false);
  const flags = useFlags(slug, pk, { includeArchived: showArchived });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Flags</CardTitle>
        </CardHeader>
        <label className="flex items-center gap-2 px-1 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />{" "}
          Show archived
        </label>
        {flags.isPending ? (
          <p role="status" className="text-sm text-slate-500">
            Loading…
          </p>
        ) : flags.isError ? (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage(flags.error)}
          </p>
        ) : flags.data.flags.length === 0 ? (
          <p role="status" className="text-sm text-slate-500">
            No flags yet.
          </p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Key</TableHeaderCell>
                <TableHeaderCell>Enabled</TableHeaderCell>
                <TableHeaderCell>Default</TableHeaderCell>
                <TableHeaderCell>Rules</TableHeaderCell>
                <TableHeaderCell>Version</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {flags.data.flags.map((flag) => {
                const summary = flag.environments.find((s) => s.envKey === env);
                return (
                  <TableRow key={flag.key} className={flag.archivedAt ? "opacity-60" : undefined}>
                    <TableCell>
                      <Link
                        to={`/orgs/${slug}/projects/${pk}/environments/${env}/flags/${flag.key}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {flag.key}
                      </Link>
                      {flag.archivedAt ? (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                          Archived
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{summary ? (summary.enabled ? "On" : "Off") : "—"}</TableCell>
                    <TableCell>{summary ? String(summary.defaultVariation) : "—"}</TableCell>
                    <TableCell>{summary ? summary.ruleCount : "—"}</TableCell>
                    <TableCell>{summary ? `v${summary.configVersion}` : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
