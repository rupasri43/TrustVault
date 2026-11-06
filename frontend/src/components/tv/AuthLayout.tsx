import type { ReactNode } from "react";
import { Wordmark } from "./primitives";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink-gradient p-12 text-ink-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="guilloche absolute inset-0 opacity-40" />
        <div className="relative"><Wordmark inverted /></div>
        <div className="relative max-w-md">
          <div className="eyebrow text-brass">Chain of custody</div>
          <p className="mt-4 font-display text-4xl font-medium leading-tight">
            Every document accounted for. Every access on the record.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-ink-line pt-6">
            {[["Per-file", "permissions"], ["Signed", "download links"], ["Complete", "audit trail"]].map(([a, b]) => (
              <div key={b}>
                <dt className="font-display text-lg text-ink-foreground">{a}</dt>
                <dd className="eyebrow mt-1 text-ink-muted">{b}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="eyebrow relative text-ink-muted">Snovasys Fresher Hiring Challenge · 2026</div>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden"><Wordmark /></div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
