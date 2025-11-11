import { useContext } from "react";
import { UserContext } from "../context/user.tsx";

export { type Session, type User } from "../context/user.tsx";

export function useAuth() {
  return useContext(UserContext);
}
