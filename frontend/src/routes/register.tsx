import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/tv/AuthLayout";
import { Field, MockNotice, inputCls } from "@/components/tv/primitives";
import { authApi, USE_MOCKS } from "@/services/api";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — TrustVault" },
      { name: "description", content: "Create a TrustVault account to receive and share protected documents." },
      { property: "og:title", content: "Create account — TrustVault" },
      { property: "og:description", content: "Create a TrustVault account to receive and share protected documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Register,
});

function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    if (password !== String(fd.get("confirm"))) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError(null);
    try {
      await authApi.register({ name: String(fd.get("name")), email: String(fd.get("email")), password });
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create account" subtitle="New accounts start as Viewers. An administrator can change your role.">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Full name"><input name="name" required className={inputCls} placeholder="Priya Sharma" /></Field>
        <Field label="Work email"><input name="email" type="email" required className={inputCls} placeholder="you@company.com" /></Field>
        <Field label="Password" hint="At least 12 characters. Password rules are checked by the server.">
          <input name="password" type="password" required minLength={12} autoComplete="new-password" className={inputCls} />
        </Field>
        <Field label="Confirm password"><input name="confirm" type="password" required autoComplete="new-password" className={inputCls} /></Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create account <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Already registered? <Link to="/" className="font-medium text-foreground underline decoration-brass underline-offset-4">Sign in</Link>
      </p>
      {USE_MOCKS && <div className="mt-8"><MockNotice>Preview mode: no account is created.</MockNotice></div>}
    </AuthLayout>
  );
}
