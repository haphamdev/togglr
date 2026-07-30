import type { RouteObject } from "react-router-dom";
import { RequireAuth } from "../auth/require-auth";
import { DashboardRoute } from "../routes/dashboard";
import { LoginRoute } from "../routes/login";
import { SettingsRoute } from "../routes/settings";
import { RootLayout } from "./layout";

/** Route tree shared by the browser router (main.tsx) and route tests. */
export const appRoutes: RouteObject[] = [
  { path: "/login", element: <LoginRoute /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <RootLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardRoute /> },
      { path: "settings", element: <SettingsRoute /> },
    ],
  },
];
