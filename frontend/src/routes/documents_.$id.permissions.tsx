import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/tv/AppShell";
import { PageHeader, Panel, Field, inputCls } from "@/components/tv/primitives";
import { authApi, permissionsApi, type AccessLevel } from "@/services/api";
import type { AuthUser } from "@/services/api/types";
import { documentQuery, permissionsQuery } from "@/services/queries";

export const Route = createFileRoute("/documents_/$id/permissions")({
  loader: async ({ context, params }) => {
    const [doc, user] = await Promise.all([
      context.queryClient.ensureQueryData(documentQuery(params.id)),
      authApi.me(),
    ]);
    if (user.id !== doc.ownerId) throw new Error("Only the document owner can manage access.");
    await context.queryClient.ensureQueryData(permissionsQuery(params.id));
  },
  component: PermissionManagement,
});

function PermissionManagement() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: doc } = useSuspenseQuery(documentQuery(id));
  const { data: permissions } = useSuspenseQuery(permissionsQuery(id));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<AccessLevel>("view");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authApi.me().then(setUser).catch(() => navigate({ to: "/" }));
  }, [navigate]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["permissions", id] });
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const grant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await permissionsApi.grant(id, { email: email.trim(), access, expiresAt: null });
      setEmail("");
      await refresh();
      toast.success("Document access granted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not grant access.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (permissionId: string) => {
    setBusy(true);
    try {
      await permissionsApi.revoke(id, permissionId);
      await refresh();
      toast.success("Access revoked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke access.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return <div className="p-8">Loading permissions...</div>;
  if (user.id !== doc.ownerId) return <AppShell><p>Only the document owner can manage access.</p></AppShell>;

  return <AppShell>
    <Link to="/documents/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back to document</Link>
    <PageHeader eyebrow="Document permissions" title="Manage access" description={`Control who can access ${doc.title}. Revocation applies to subsequent requests.`} />
    <Panel title="Grant access" eyebrow="Add a named user">
      <form onSubmit={grant} className="grid gap-4 p-5 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <Field label="Registered user email"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="viewer@example.com" /></Field>
        <Field label="Permission"><select value={access} onChange={(e) => setAccess(e.target.value as AccessLevel)} className={inputCls}><option value="view">Read and download</option><option value="edit">Edit document</option></select></Field>
        <button disabled={busy} className="rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Grant access"}</button>
      </form>
    </Panel>
    <Panel title="Current access" eyebrow={`${permissions.length} explicit grants`}>
      {permissions.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No other users have access.</p> : <ul>{permissions.map((item) => <li key={item.id} className="flex items-center justify-between gap-4 border-b border-border p-5 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.userName}</p><p className="truncate text-xs text-muted-foreground">{item.userEmail}</p><p className="mt-1 text-xs text-muted-foreground">{item.access === "edit" ? "Can edit" : "Can read and download"} · granted {item.grantedAt}</p></div><button type="button" disabled={busy} onClick={() => revoke(item.id)} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"><Trash2 className="h-4 w-4" /> Revoke</button></li>)}</ul>}
    </Panel>
  </AppShell>;
}
