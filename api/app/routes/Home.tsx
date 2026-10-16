import { Navigate, useLocation } from "react-router";

/**
 * Keeps the URL fragment: a sign-in link whose redirect isn't allow-listed
 * lands here, on the Site URL, with the session in the fragment, and `/login`
 * has to receive it to sign in.
 */
export default function Home() {
  const { hash } = useLocation();

  if (hash) {
    return <Navigate to={{ pathname: "/login", hash }} replace />;
  }

  return <Navigate to="/account" replace />;
}
