import { createContext, useState } from "react";
import { type User } from "../hooks/use-auth.ts";

export const UserContext = createContext<
  {
    user: User | undefined;
    setUser: (user: User | undefined) => void;
    isOnCooldown: boolean;
    setIsOnCooldown: (cooldown: boolean) => void;
    isValidated: boolean;
    setIsValidated: (validated: boolean) => void;
  }
>({
  user: undefined,
  setUser: () => {},
  isOnCooldown: false,
  setIsOnCooldown: () => {},
  isValidated: false,
  setIsValidated: () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | undefined>(undefined);
  const [isOnCooldown, setIsOnCooldown] = useState<boolean>(false);
  const [isValidated, setIsValidated] = useState<boolean>(false);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        isOnCooldown,
        setIsOnCooldown,
        isValidated,
        setIsValidated,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
