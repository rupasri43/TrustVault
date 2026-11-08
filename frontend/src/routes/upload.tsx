import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, NotInRoleView } from "@/components/tv/AppShell";
import { Field, MockNotice, PageHeader, Panel, inputCls } from "@/components/tv/primitives";
import { authApi } from "@/services/api";
import { formatBytes } from "@/lib/format";
import { documentsApi, USE_MOCKS, type Classification } from "@/services/api";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload document — TrustVault" },
      { name: "description", content: "Upload a document to TrustVault and set its classification." },
      { property: "og:title", content: "Upload document — TrustVault" },
      { property: "og:description", content: "Upload a document to TrustVault and set its classification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UploadPage,
});

const LEVELS: { value: Classification; note: string }[] = [
  { value: "public", note: "Public classification; access still requires an explicit grant" },
  { value: "internal", note: "Named staff only" },
  { value: "confidential", note: "Need-to-know" },
  { value: "restricted", note: "Strictly limited, short expiry" },
];

function UploadPage() {
  const [role, setRole] = useState<"administrator" | "owner" | "viewer" | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    authApi.me().then((user) => setRole(user.role)).catch(() => navigate({ to: "/" }));
  }, [navigate]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [level, setLevel] = useState<Classification>("internal");
  const [busy, setBusy] = useState(false);

  if (role === null) return <div className="p-8">Loading your permissions...</div>;
  if (role !== "owner") return <AppShell><NotInRoleView role={role} /></AppShell>;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) { toast.error("Choose a file first."); return; }
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await documentsApi.upload({
        file,
        title: String(fd.get("title")),
        description: String(fd.get("description")),
        classification: level,
        expiresAt: null,
      });
      toast.success(USE_MOCKS ? "Preview only — the file was not stored." : "Document uploaded.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      {USE_MOCKS && <MockNotice>Preview mode: files are not uploaded or stored anywhere.</MockNotice>}
      <PageHeader eyebrow="New entry" title="Upload document" description="Add a file to the register. File checks, encryption and storage happen on the server." />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="File" eyebrow="Step 1">
          <div className="p-5">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files[0] ?? null); }}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-14 text-center transition ${drag ? "border-brass bg-brass-soft" : "border-border bg-background hover:border-brass/60"}`}
            >
              <FileUp className="h-8 w-8 text-brass" />
              <p className="mt-3 font-medium">Drop a file or click to browse</p>
              <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, PNG, JPG, TXT, CSV · up to 10 MB</p>
              <input ref={inputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            {file && (
              <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-background px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
                </div>
                <button type="button" aria-label="Remove file" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            )}
            <div className="mt-5 space-y-4">
              <Field label="Title"><input name="title" required className={inputCls} placeholder="e.g. Q1 Audit Findings" /></Field>
              <Field label="Description"><textarea name="description" rows={3} className={inputCls} placeholder="What is this document for?" /></Field>
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Classification" eyebrow="Step 2">
            <div className="space-y-2 p-5">
              {LEVELS.map((l) => (
                <button type="button" key={l.value} onClick={() => setLevel(l.value)} className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition ${level === l.value ? "border-brass bg-brass-soft" : "border-border hover:bg-secondary"}`}>
                  <div>
                    <div className="eyebrow font-medium text-foreground">{l.value}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{l.note}</div>
                  </div>
                  <span className={`h-3.5 w-3.5 rounded-full border-2 ${level === l.value ? "border-brass bg-brass" : "border-input"}`} />
                </button>
              ))}
            </div>
          </Panel>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to register"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
