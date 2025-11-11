import { Navigate } from "react-router";
import { useAuth } from "../hooks/use-auth.ts";
import { LoadingState } from "../components/Auth/LoadingState.tsx";
import { LoginForm } from "../components/Auth/LoginForm.tsx";

export default function Login() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return <LoadingState />;
  }

  if (user) {
    return <Navigate to="/account" replace />;
  }

  return <LoginForm />;
}
