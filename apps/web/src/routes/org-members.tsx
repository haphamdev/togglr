/** Org members route: manage member roles/removal and teammate invites for the current org. */

import type { OrgRole } from "@togglr/shared-types";
import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { useOrgRole } from "../auth/auth-context";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../components/ui/table";
import { errorMessage } from "../org/error-messages";
import { useCreateInvite, useInvites, useResendInvite, useRevokeInvite } from "../org/use-invites";
import { useMembers, useRemoveMember, useUpdateMemberRole } from "../org/use-members";

export function OrgMembersRoute() {
  const slug = useParams().orgSlug as string;

  const callerRole = useOrgRole(slug);
  const isOwner = callerRole === "owner";

  const members = useMembers(slug);
  const updateRole = useUpdateMemberRole(slug);
  const removeMember = useRemoveMember(slug);
  const membersError = errorMessage(updateRole.error ?? removeMember.error);

  const invites = useInvites(slug);
  const createInvite = useCreateInvite(slug);
  const resendInvite = useResendInvite(slug);
  const revokeInvite = useRevokeInvite(slug);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");

  const onCreateInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createInvite.mutate(
      { email, role },
      {
        onSuccess: () => {
          setEmail("");
          setRole("member");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        {members.isPending ? (
          <p role="status" className="text-sm text-slate-500">
            Loading…
          </p>
        ) : members.isError ? (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage(members.error)}
          </p>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.data.members.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>{m.name ?? "—"}</TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Select
                          aria-label={`Role for ${m.email}`}
                          value={m.role}
                          onChange={(e) =>
                            updateRole.mutate({ userId: m.userId, role: e.target.value as OrgRole })
                          }
                        >
                          <option value="owner">owner</option>
                          <option value="admin">admin</option>
                          <option value="member">member</option>
                        </Select>
                      ) : (
                        m.role
                      )}
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Button variant="ghost" onClick={() => removeMember.mutate(m.userId)}>
                          Remove
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {membersError ? (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {membersError}
              </p>
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invites</CardTitle>
        </CardHeader>
        <form className="mb-6 flex flex-wrap items-end gap-3" onSubmit={onCreateInvite}>
          <Input
            type="email"
            aria-label="Invite email"
            placeholder="teammate@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Select
            aria-label="Invite role"
            value={role}
            onChange={(e) => setRole(e.target.value as OrgRole)}
          >
            <option value="owner">owner</option>
            <option value="admin">admin</option>
            <option value="member">member</option>
          </Select>
          <Button type="submit" disabled={createInvite.isPending}>
            Send invite
          </Button>
        </form>
        {createInvite.error ? (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {errorMessage(createInvite.error)}
          </p>
        ) : null}
        {invites.isPending ? (
          <p role="status" className="text-sm text-slate-500">
            Loading…
          </p>
        ) : invites.isError ? (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage(invites.error)}
          </p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invites.data.invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>{invite.email}</TableCell>
                  <TableCell>{invite.role}</TableCell>
                  <TableCell>{invite.status}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button variant="ghost" onClick={() => resendInvite.mutate(invite.id)}>
                      Resend
                    </Button>
                    <Button variant="ghost" onClick={() => revokeInvite.mutate(invite.id)}>
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
