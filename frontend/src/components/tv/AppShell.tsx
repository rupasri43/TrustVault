import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Files, Upload, ScrollText, ShieldCheck, LogOut, Menu, X } from "lucide-react";
import { ROLE_LABEL } from "@/lib/preview-role";
import type { Role, AuthUser } from "@/services/api/types";
import { authApi } from "@/services/api";
import { Wordmark } from "./primitives";

type NavItem = { to: "/dashboard" | "/upload" | "/audit" | "/admin"; label: string; icon: typeof Files; roles: Role[] };
const NAV: NavItem[] = [
  { to: "/dashboard", label: "Documents", icon: Files, roles: ["administrator", "owner", "viewer"] },
  { to: "/upload", label: "Upload", icon: Upload, roles: ["owner"] },
  { to: "/audit", label: "Audit activity", icon: ScrollText, roles: ["administrator"] },
  { to: "/admin", label: "Administration", icon: ShieldCheck, roles: ["administrator"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    authApi.me()
      .then(setUser)
      .catch(() => navigate({ to: "/" }));
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      navigate({ to: "/" });
    }
  };

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center">Loading your workspace...</div>;
  }

  const role = user.role;

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-gradient text-ink-foreground">
      <div className="px-6 py-6"><Wordmark inverted /></div>
      <nav className="flex-1 space-y-1 px-3">
        <div className="eyebrow px-3 pb-2 text-ink-muted">Workspace</div>
        {NAV.filter((n) => n.roles.includes(role)).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            onClick={() => setOpen(false)}
            className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-ink-muted transition hover:bg-sidebar-accent hover:text-ink-foreground"
            activeProps={{ className: "!bg-sidebar-accent !text-ink-foreground shadow-[inset_2px_0_0_var(--color-brass)]" }}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-ink-line px-5 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-full border border-brass/60 font-display text-sm text-brass">
          {user.name.split(" ").map((p) => p[0]).join("")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{user.name}</div>
          <div className="eyebrow truncate text-ink-muted">{ROLE_LABEL[role]}</div>
        </div>
        <button aria-label="Sign out" onClick={handleLogout} className="rounded p-1.5 text-ink-muted hover:text-ink-foreground">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      <div className="flex items-center justify-between border-b border-border bg-ink px-4 py-3 lg:hidden">
        <Wordmark inverted />
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="text-ink-foreground"><Menu className="h-5 w-5" /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">
            <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-6 z-10 text-ink-foreground"><X className="h-5 w-5" /></button>
            {sidebar}
          </div>
        </div>
      )}
      <main className="min-w-0 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-6xl space-y-8">{children}</div>
      </main>
    </div>
  );
}

/** Shown when a role's layout does not include a page. Not a security boundary. */
export function NotInRoleView({ role }: { role: Role }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <div className="eyebrow text-brass">Not part of this view</div>
      <h2 className="mt-2 text-xl font-semibold">This page isn't shown to the {ROLE_LABEL[role]} role</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Your account does not have permission to open this section. The server enforces access independently of the interface.</p>
    </div>
  );
}
