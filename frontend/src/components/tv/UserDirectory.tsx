import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ROLE_LABEL } from "@/lib/preview-role";
import { formatDateTime } from "@/lib/format";
import { adminApi, USE_MOCKS, type Role, type User } from "@/services/api";
import { adminUsersQuery } from "@/services/queries";
import { Field, inputCls } from "./primitives";

const ROLES: Role[] = ["administrator", "owner", "viewer"];

export function UserDirectory({ users }: { users: User[] }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [editing, setEditing] = useState<User | null>(null);
  const [draft, setDraft] = useState<Pick<User, "role">>({ role: "viewer" });
  const [saving, setSaving] = useState(false);

  const rows = users.filter(
    (u) => (roleFilter === "all" || u.role === roleFilter) &&
      (u.name + u.email).toLowerCase().includes(q.toLowerCase()),
  );

  const open = (u: User) => { setEditing(u); setDraft({ role: u.role }); };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateUser(editing.id, { role: draft.role });
      qc.setQueryData(adminUsersQuery().queryKey, users.map((u) => (u.id === updated.id ? updated : u)));
      toast.success(USE_MOCKS ? "Shown in preview only — not saved." : `Updated ${updated.name}.`);
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className={`${inputCls} pl-9`} />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", ...ROLES] as const).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)} className={`eyebrow rounded-sm px-2.5 py-1.5 ${roleFilter === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
              {r === "all" ? "all" : r === "administrator" ? "admin" : r}
            </button>
          ))}
        </div>
      </div>
      <ul>
  {rows.map((u) => (
    <li
      key={u.id}
      className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border px-5 py-3.5 last:border-0 sm:grid-cols-[1fr_140px_90px_40px]"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{u.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {u.email}
        </div>
      </div>

      <span className="eyebrow hidden text-foreground sm:block">
        {ROLE_LABEL[u.role]}
      </span>

      <span
        className={`eyebrow hidden sm:block ${
          u.status === "active" ? "text-verified" : "text-warning"
        }`}
      >
        {u.status}
      </span>

      <button
        aria-label={`Edit ${u.name}`}
        onClick={() => open(u)}
        className="justify-self-end rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <UserCog className="h-4 w-4" />
      </button>
    </li>
  ))}

  {rows.length === 0 && (
    <li className="px-5 py-10 text-center text-sm text-muted-foreground">
      No users match.
    </li>
  )}
</ul>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="font-display">Edit {editing?.name}</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Role">
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <button key={r} type="button" onClick={() => setDraft((d) => ({ ...d, role: r }))} className={`rounded-md border px-3 py-2.5 text-xs font-medium ${draft.role === r ? "border-brass bg-brass-soft" : "border-border hover:bg-secondary"}`}>{ROLE_LABEL[r]}</button>
                ))}
              </div>
            </Field>

            <p className="text-xs text-muted-foreground">Role changes are checked and recorded by the server. Account suspension is not implemented.</p>
          </div>
          <DialogFooter>
            <button onClick={() => setEditing(null)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
