import { Navigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/use-auth.ts";
import { homeFor, useConferenceRoles } from "../hooks/use-conference-roles.ts";
import { LoadingState } from "../components/Auth/LoadingState.tsx";
import { LoginForm } from "../components/Auth/LoginForm.tsx";
import { EmailLinkSignIn } from "../components/Auth/EmailLinkSignIn.tsx";

/**
 * The one sign-in page, with the code from the sign-in email or with its link
 * (`?token_hash=`). The link is checked first, so it also replaces a session
 * the browser already has, such as an anonymous attendee's. Afterwards it goes
 * to `?next=` when given, else by role: organizers to the management pages,
 * everyone else to their account, where moderators pick a talk to moderate.
 */
export default function Login() {
  const [params] = useSearchParams();
  const tokenHash = params.get("token_hash");

  if (tokenHash) {
    return <EmailLinkSignIn tokenHash={tokenHash} />;
  }

  return <SignIn next={params.get("next")} />;
}

function SignIn({ next }: { next: string | null }) {
  const { user, isLoading: authLoading } = useAuth();
  const { data: roles, isLoading: rolesLoading } = useConferenceRoles();
  // Only same-site paths, so ?next= can't send people to another site.
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;

  if (authLoading || (user && !safeNext && rolesLoading)) {
    return <LoadingState />;
  }

  if (user) {
    return <Navigate to={safeNext ?? homeFor(roles ?? [])} replace />;
  }

  return <LoginForm />;
}
