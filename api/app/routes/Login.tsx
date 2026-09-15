import { Navigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/use-auth.ts";
import { LoadingState } from "../components/Auth/LoadingState.tsx";
import { LoginForm } from "../components/Auth/LoginForm.tsx";

export default function Login() {
  const { user, isLoading: authLoading } = useAuth();
  const [params] = useSearchParams();
  // Only same-site paths, so ?next= can't send people to another site.
  const next = params.get("next");
  const destination = next?.startsWith("/") && !next.startsWith("//")
    ? next
    : "/account";

  if (authLoading) {
    return <LoadingState />;
  }

  if (user) {
    return <Navigate to={destination} replace />;
  }

  return <LoginForm />;
}
