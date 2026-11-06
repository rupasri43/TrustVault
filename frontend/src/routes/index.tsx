import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/tv/AuthLayout";
import { Field, MockNotice, inputCls } from "@/components/tv/primitives";
import { authApi, USE_MOCKS } from "@/services/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — TrustVault" },
      { name: "description", content: "Sign in to TrustVault, secure document sharing with per-file permissions and a full audit trail." },
      { property: "og:title", content: "Sign in — TrustVault" },
      { property: "og:description", content: "Secure document sharing with per-file permissions and a full audit trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      await authApi.login({ email: String(fd.get("email")), password: String(fd.get("password")) });
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Access the documents shared with you.">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Work email"><input name="email" type="email" required autoComplete="email" className={inputCls} placeholder="you@company.com" /></Field>
        <Field label="Password"><input name="password" type="password" required autoComplete="current-password" className={inputCls} placeholder="••••••••" /></Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        New to TrustVault? <Link to="/register" className="font-medium text-foreground underline decoration-brass underline-offset-4">Create an account</Link>
      </p>
      {USE_MOCKS && <div className="mt-8"><MockNotice>Preview mode: any email and password continue to the demo workspace. No real sign-in happens.</MockNotice></div>}
    </AuthLayout>
  );
}
