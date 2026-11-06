import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Eye, KeyRound, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/tv/AppShell";
import { AccessTag, ClassificationTag, MockNotice, PageHeader, Panel } from "@/components/tv/primitives";
import { authApi } from "@/services/api";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { documentQuery, permissionsQuery } from "@/services/queries";
import { documentsApi, USE_MOCKS } from "@/services/api";
import { useEffect, useState } from "react";
export const Route = createFileRoute("/documents/$id")({
  head: () => ({
    meta: [
      { title: "Document details — TrustVault" },
      { name: "description", content: "Document metadata, integrity fingerprint, access list and recent activity." },
      { property: "og:title", content: "Document details — TrustVault" },
      { property: "og:description", content: "Document metadata, integrity fingerprint, access list and recent activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context, params }) => {
  await Promise.all([
    context.queryClient.ensureQueryData(documentQuery(params.id)),
    context.queryClient.ensureQueryData(permissionsQuery(params.id)),
  ]);
},
  errorComponent: () => (
    <AppShell><div className="rounded-lg border border-border bg-card p-10 text-center"><h2 className="text-xl font-semibold">Document unavailable</h2><p className="mt-2 text-sm text-muted-foreground">It may not exist, or you may not have access.</p><Link to="/dashboard" className="mt-4 inline-block text-sm underline">Back to documents</Link></div></AppShell>
  ),
  component: DocumentDetails,
});

function DocumentDetails() {
  const { id } = Route.useParams();
  const { data: doc } = useSuspenseQuery(documentQuery(id));
  const { data: perms } = useSuspenseQuery(permissionsQuery(id));
  const [currentUser, setCurrentUser] = useState<Awaited<ReturnType<typeof authApi.me>> | null>(null);

  useEffect(() => {
    authApi.me()
    .then(setCurrentUser)
    .catch(() => setCurrentUser(null));
}, []);

const canManage =
  currentUser !== null &&
  (currentUser.role === "owner" || currentUser.role === "administrator") &&
  currentUser.id === doc.ownerId;

  const download = async () => {
  try {
    if (USE_MOCKS) {
      toast.info("Preview only — no file is downloaded.");
      return;
    }

    const blob = await documentsApi.downloadUrl(doc.id);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(objectUrl);
    toast.success("Document downloaded successfully.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Download failed.");
  }
};
  return (
    <AppShell>
      {USE_MOCKS && <MockNotice />}
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Documents</Link>
      <PageHeader
        eyebrow={`Entry ${doc.id.toUpperCase()} · v${doc.version}`}
        title={doc.title}
        description={doc.description}
        actions={<>
          <button onClick={download} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary"><Download className="h-4 w-4" /> Download</button>
          {canManage && <Link to="/documents/$id/permissions" params={{ id: doc.id }} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"><KeyRound className="h-4 w-4" /> Manage access</Link>}
        </>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Record" eyebrow="Metadata">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 text-sm sm:grid-cols-3">
              {[
                ["Classification", <ClassificationTag key="c" value={doc.classification} />],
                ["Owner", doc.ownerName],
                ["File", doc.fileName],
                ["Size", formatBytes(doc.sizeBytes)],
                ["Created", formatDate(doc.createdAt)],
                ["Access expires", doc.expiresAt ? formatDate(doc.expiresAt) : "No expiry"],
              ].map(([k, v]) => (
                <div key={String(k)}><dt className="eyebrow text-muted-foreground">{k}</dt><dd className="mt-1.5 truncate">{v}</dd></div>
              ))}
            </dl>
          </Panel>
          <Panel>
            <div className="flex items-start gap-4 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-brass/50 bg-brass-soft"><Fingerprint className="h-5 w-5 text-brass" /></div>
              <div className="min-w-0">
                <div className="eyebrow text-muted-foreground">SHA-256 fingerprint</div>
                <code className="mt-1.5 block break-all font-mono text-xs">{doc.sha256}</code>
                <p className="mt-2 text-xs text-muted-foreground">Reported by the server. Integrity checking is not active in this preview.</p>
              </div>
            </div>
          </Panel>
          <Panel title="Recent activity" eyebrow="Audit">
  <ul>
    <li className="px-5 py-6 text-sm text-muted-foreground">
      Recent activity is available in the Audit Activity section for administrators.
    </li>
  </ul>
</Panel>
        </div>
        <Panel title="Who has access" eyebrow={`${perms.length} people`}>
          <ul>
            {perms.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5 last:border-0">
                <div className="min-w-0"><div className="truncate text-sm font-medium">{p.userName}</div><div className="truncate text-xs text-muted-foreground">{p.expiresAt ? `Until ${formatDateTime(p.expiresAt)}` : "No expiry"}</div></div>
                <AccessTag value={p.access} />
              </li>
            ))}
            {perms.length === 0 && <li className="px-5 py-6 text-sm text-muted-foreground">Only the owner has access.</li>}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
