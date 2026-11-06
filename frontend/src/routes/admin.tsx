import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/tv/AppShell";
import { UserDirectory } from "@/components/tv/UserDirectory";
import { MockNotice, PageHeader, Panel, Stat } from "@/components/tv/primitives";
import { formatBytes, formatDateTime } from "@/lib/format";
import { adminStatsQuery, adminUsersQuery, auditQuery } from "@/services/queries";
import { USE_MOCKS } from "@/services/api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — TrustVault" },
      { name: "description", content: "Organisation overview: users, roles, storage and denied access attempts." },
      { property: "og:title", content: "Administration — TrustVault" },
      { property: "og:description", content: "Organisation overview: users, roles, storage and denied access attempts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(adminStatsQuery()),
      context.queryClient.ensureQueryData(adminUsersQuery()),
      context.queryClient.ensureQueryData(auditQuery()),
    ]);
  },
  component: Admin,
});

function Admin() {
  const { data: stats } = useSuspenseQuery(adminStatsQuery());
  const { data: users } = useSuspenseQuery(adminUsersQuery());
  const { data: audit } = useSuspenseQuery(auditQuery());
  const denied = audit.filter((a) => a.outcome === "denied");

  return (
    <AppShell>
      {USE_MOCKS && <MockNotice />}
      <PageHeader eyebrow="Administrator" title="Organisation overview" description="Users, roles and access signals across TrustVault." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={stats.totalUsers} />
        <Stat label="Documents" value={stats.totalDocuments} />
        <Stat label="Active shares" value={stats.activeShares} />
        <Stat label="Denied · 24h" value={stats.deniedAttempts24h} hint={`${formatBytes(stats.storageUsedBytes)} stored`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Users & roles" eyebrow={`Directory · ${users.length}`}>
          <UserDirectory users={users} />
        </Panel>
        <Panel title="Denied attempts" eyebrow="Signals" action={<Link to="/audit" className="text-xs underline decoration-brass underline-offset-4">Full ledger</Link>}>
          <ul>
            {denied.map((e) => (
              <li key={e.id} className="border-b border-border px-5 py-3.5 last:border-0">
                <div className="flex items-center justify-between text-sm"><span className="font-medium">{e.actorEmail}</span><span className="eyebrow text-destructive">{e.action.replace("_", " ")}</span></div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{formatDateTime(e.at)} · {e.ip}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
