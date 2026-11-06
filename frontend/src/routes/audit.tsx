import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell, NotInRoleView } from "@/components/tv/AppShell";
import { Search } from "lucide-react";
import { MockNotice, PageHeader, Panel, inputCls } from "@/components/tv/primitives";
import { usePreviewRole } from "@/lib/preview-role";
import { formatDateTime } from "@/lib/format";
import { auditQuery } from "@/services/queries";
import { USE_MOCKS, type AuditAction } from "@/services/api";

const ACTIONS: AuditAction[] = ["login", "failed_login", "upload", "view", "download", "share", "revoke", "delete", "role_change"];

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit activity — TrustVault" },
      { name: "description", content: "Chronological record of sign-ins, views, downloads, shares and revocations." },
      { property: "og:title", content: "Audit activity — TrustVault" },
      { property: "og:description", content: "Chronological record of sign-ins, views, downloads, shares and revocations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(auditQuery()),
  component: Audit,
});

function Audit() {
  const { role } = usePreviewRole();
  const { data } = useSuspenseQuery(auditQuery());
  const [outcome, setOutcome] = useState<"all" | "success" | "denied">("all");
  const [q, setQ] = useState("");
  const [action, setAction] = useState<"all" | AuditAction>("all");
  const rows = useMemo(
    () => data.filter((e) =>
      (outcome === "all" || e.outcome === outcome) &&
      (action === "all" || e.action === action) &&
      `${e.actorName} ${e.actorEmail} ${e.target} ${e.ip}`.toLowerCase().includes(q.toLowerCase())),
    [data, outcome, action, q],
  );

  if (role === "viewer") return <AppShell><NotInRoleView role={role} /></AppShell>;

  return (
    <AppShell>
      {USE_MOCKS && <MockNotice />}
      <PageHeader
        eyebrow="Ledger"
        title="Audit activity"
        description={role === "administrator" ? "All activity across the organisation." : "Activity on documents you own."}
        actions={
          <div className="flex rounded-md border border-border bg-card p-1">
            {(["all", "success", "denied"] as const).map((o) => (
              <button key={o} onClick={() => setOutcome(o)} className={`eyebrow rounded-sm px-3 py-1.5 ${outcome === o ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{o}</button>
            ))}
          </div>
        }
      />
      <Panel>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search person, document or IP" className={`${inputCls} pl-9`} />
          </div>
          <select aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value as typeof action)} className={`${inputCls} sm:w-48`}>
            <option value="all">All actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a.replace("_", " ")}</option>)}
          </select>
        </div>
        {rows.length === 0 && <p className="px-5 py-12 text-center text-sm text-muted-foreground">No events match these filters.</p>}
        <ol className="relative">
          {rows.map((e) => (
            <li key={e.id} className="grid gap-2 border-b border-border px-5 py-4 last:border-0 md:grid-cols-[170px_1fr_120px_90px] md:items-center md:gap-4">
              <time className="font-mono text-xs text-muted-foreground">{formatDateTime(e.at)}</time>
              <div className="min-w-0">
                <div className="text-sm"><b className="font-medium">{e.actorName}</b> <span className="eyebrow ml-1 rounded-sm bg-secondary px-1.5 py-0.5">{e.action.replace("_", " ")}</span></div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{e.target}</div>
              </div>
              <div className="font-mono text-xs text-muted-foreground">{e.ip}</div>
              <div className={`eyebrow flex items-center gap-1.5 ${e.outcome === "denied" ? "text-destructive" : "text-verified"}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />{e.outcome}
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </AppShell>
  );
}
