import { Navigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/use-auth.ts";
import { homeFor, useConferenceRoles } from "../hooks/use-conference-roles.ts";
import { LoadingState } from "../components/Auth/LoadingState.tsx";
import { LoginForm } from "../components/Auth/LoginForm.tsx";

/**
 * The one sign-in page. Afterwards it goes to `?next=` when given, else by
 * role: organizers to the management pages, everyone else to their account,
 * where moderators pick a talk to moderate.
 */
export default function Login() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: roles, isLoading: rolesLoading } = useConferenceRoles();
  const [params] = useSearchParams();
  // Only same-site paths, so ?next= can't send people to another site.
  const next = params.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;

  if (authLoading || (user && !safeNext && rolesLoading)) {
    return <LoadingState />;
  }

  if (user) {
    return <Navigate to={safeNext ?? homeFor(roles ?? [])} replace />;
  }

  return <LoginForm />;
}
