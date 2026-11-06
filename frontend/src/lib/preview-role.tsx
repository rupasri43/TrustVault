/**
 * PREVIEW ROLE — UI only.
 * Lets reviewers switch between Administrator / Owner / Viewer layouts while the backend
 * is not connected. This is NOT authorization: the Flask backend must enforce every permission.
 * Once connected, the role should come from the authenticated user returned by the backend.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "@/services/api/types";

const KEY = "trustvault.previewRole";
const Ctx = createContext<{ role: Role; setRole: (r: Role) => void }>({ role: "owner", setRole: () => {} });

export function PreviewRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("owner");
  useEffect(() => {
    const saved = window.localStorage.getItem(KEY) as Role | null;
    if (saved === "administrator" || saved === "owner" || saved === "viewer") setRoleState(saved);
  }, []);
  const setRole = (r: Role) => {
    setRoleState(r);
    window.localStorage.setItem(KEY, r);
  };
  return <Ctx.Provider value={{ role, setRole }}>{children}</Ctx.Provider>;
}

export const usePreviewRole = () => useContext(Ctx);

export const ROLE_LABEL: Record<Role, string> = {
  administrator: "Administrator",
  owner: "Document Owner",
  viewer: "Viewer",
};

/** Mock user id shown for each preview role (matches src/mocks). Demo only. */
export const PREVIEW_USER_ID: Record<Role, string> = { administrator: "u1", owner: "u2", viewer: "u4" };
