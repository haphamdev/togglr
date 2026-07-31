import type { RouteObject } from "react-router-dom";
import { RequireAuth } from "../auth/require-auth";
import { EnvironmentKeysRoute } from "../routes/environment-keys";
import { InviteAcceptRoute } from "../routes/invite-accept";
import { LoginRoute } from "../routes/login";
import { OrgMembersRoute } from "../routes/org-members";
import { OrgProjectsRoute } from "../routes/org-projects";
import { OrgSettingsRoute } from "../routes/org-settings";
import { OrgsIndexRoute } from "../routes/orgs-index";
import { ProjectEnvironmentsRoute } from "../routes/project-environments";
import { SignupRoute } from "../routes/signup";
import { RootLayout } from "./layout";

/** Route tree shared by the browser router (main.tsx) and route tests. */
export const appRoutes: RouteObject[] = [
  { path: "/login", element: <LoginRoute /> },
  { path: "/signup", element: <SignupRoute /> },
  { path: "/invite/:token", element: <InviteAcceptRoute /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <RootLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <OrgsIndexRoute /> },
      { path: "orgs/:orgSlug", element: <OrgProjectsRoute /> },
      { path: "orgs/:orgSlug/members", element: <OrgMembersRoute /> },
      { path: "orgs/:orgSlug/settings", element: <OrgSettingsRoute /> },
      { path: "orgs/:orgSlug/projects/:projectKey", element: <ProjectEnvironmentsRoute /> },
      {
        path: "orgs/:orgSlug/projects/:projectKey/environments/:envKey",
        element: <EnvironmentKeysRoute />,
      },
    ],
  },
];
