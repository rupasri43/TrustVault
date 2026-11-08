import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FileText, Search, Upload, Users } from "lucide-react";
import { AppShell } from "@/components/tv/AppShell";
import { ClassificationTag, MockNotice, PageHeader, Panel, Stat, inputCls } from "@/components/tv/primitives";
import { authApi } from "@/services/api";
import type { AuthUser } from "@/services/api/types";
import { useNavigate } from "@tanstack/react-router";
import { formatBytes, formatDate } from "@/lib/format";
import { documentsQuery } from "@/services/queries";
import { USE_MOCKS, type Classification } from "@/services/api";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Documents — TrustVault" },
      { name: "description", content: "Your protected documents and the files shared with you." },
      { property: "og:title", content: "Documents — TrustVault" },
      { property: "og:description", content: "Your protected documents and the files shared with you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(documentsQuery()),
  component: Dashboard,
});

const FILTERS: ("all" | Classification)[] = ["all", "restricted", "confidential", "internal", "public"];

function Dashboard() {
  const { data: docs } = useSuspenseQuery(documentsQuery());
  const [user, setUser] = useState<AuthUser | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    authApi.me().then(setUser).catch(() => navigate({ to: "/" }));
  }, [navigate]);
  const role = user?.role ?? null;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tab, setTab] = useState<"all" | "mine" | "shared">("all");
  const myId = user?.id;

  const rows = useMemo(
    () => docs.filter((d) =>
      (filter === "all" || d.classification === filter) &&
      (tab === "all" || (tab === "mine" ? d.ownerId === myId : d.ownerId !== myId)) &&
      `${d.title} ${d.fileName} ${d.ownerName} ${d.ownerEmail ?? ""}`.toLowerCase().includes(q.toLowerCase()) &&
      (!dateFrom || d.updatedAt.slice(0, 10) >= dateFrom) &&
      (!dateTo || d.updatedAt.slice(0, 10) <= dateTo)),
    [docs, q, filter, tab, myId, dateFrom, dateTo],
  );
  const canUpload = role === "owner";

  if (role === null) return <div className="p-8">Loading your workspace...</div>;

  return (
    <AppShell>
      {USE_MOCKS && <MockNotice />}
      <PageHeader
        eyebrow={role === "viewer" ? "Shared with you" : "Document register"}
        title={role === "viewer" ? "Shared documents" : "Documents"}
        description={role === "viewer" ? "Files other people have given you access to." : "Files you own and files shared with you."}
        actions={canUpload && (
          <Link to="/upload" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Upload className="h-4 w-4" /> Upload document
          </Link>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Documents" value={docs.length} hint="in this view" />
        <Stat label="Restricted" value={docs.filter((d) => d.classification === "restricted").length} hint="highest classification" />
        <Stat label="Active shares" value={docs.reduce((s, d) => s + d.sharedWith, 0)} hint="across all documents" />
      </div>

      {role !== "viewer" && (
        <div role="tablist" className="flex gap-6 border-b border-border">
          {([["all", "All documents"], ["mine", "Owned by me"], ["shared", "Shared with me"]] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 pb-3 text-sm font-medium transition ${tab === k ? "border-brass text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
      )}


      <Panel>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title" className={`${inputCls} pl-9`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground">From <input aria-label="Filter from date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="ml-1 rounded border border-border bg-background px-2 py-1" /></label>
            <label className="text-xs text-muted-foreground">To <input aria-label="Filter to date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="ml-1 rounded border border-border bg-background px-2 py-1" /></label>
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`eyebrow rounded-sm px-2.5 py-1.5 transition ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>{f}</button>
            ))}
          </div>
        </div>

        <div className="hidden grid-cols-[1fr_140px_120px_100px_90px] gap-4 border-b border-border px-5 py-2.5 md:grid">
          {["Document", "Classification", "Updated", "Size", "Shared"].map((h) => <div key={h} className="eyebrow text-muted-foreground">{h}</div>)}
        </div>
        <ul>
          {rows.map((d, i) => (
            <li key={d.id}>
              <Link to="/documents/$id" params={{ id: d.id }} className="grid gap-2 border-b border-border px-5 py-4 transition last:border-0 hover:bg-secondary/60 md:grid-cols-[1fr_140px_120px_100px_90px] md:items-center md:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="eyebrow w-6 text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-border bg-background"><FileText className="h-4 w-4 text-brass" /></div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{d.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{d.fileType} · {d.ownerName}</div>
                  </div>
                </div>
                <div><ClassificationTag value={d.classification} /></div>
                <div className="text-sm text-muted-foreground">{formatDate(d.updatedAt)}</div>
                <div className="text-sm tabular-nums text-muted-foreground">{formatBytes(d.sizeBytes)}</div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="h-3.5 w-3.5" />{d.sharedWith}</div>
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="px-5 py-12 text-center text-sm text-muted-foreground">No documents match.</li>}
        </ul>
      </Panel>
    </AppShell>
  );
}
