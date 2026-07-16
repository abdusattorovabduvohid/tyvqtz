"use client";

import { createContext, useContext } from "react";
import { can as canFn, type Action, type Permissions } from "@/lib/permissions";

export interface ClientUser {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  photo: string | null;
  role: {
    id: string;
    nameUz: string;
    nameRu: string | null;
    isSuperAdmin: boolean;
    permissions: Permissions;
  };
}

const UserContext = createContext<ClientUser | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: ClientUser;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): ClientUser {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser должен использоваться внутри UserProvider");
  return ctx;
}

// Хук проверки прав текущего пользователя.
export function useCan() {
  const user = useUser();
  return (section: string, action: Action) =>
    canFn(user.role, section, action);
}
