import { Navigate } from "react-router";
import { useAuth } from "../hooks/use-auth.ts";
import { LoadingState } from "../components/Auth/LoadingState.tsx";
import { Account } from "../components/Auth/Account.tsx";

export default function AccountRoute() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return <LoadingState />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Account user={user} />;
}
