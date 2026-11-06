import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AccessLevel, Classification } from "@/services/api/types";

export function Seal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-8 w-8", className)} aria-hidden>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="20" cy="20" r="14.5" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
      <path d="M20 10 L28 13.5 V20 C28 25 24.5 28.5 20 30 C15.5 28.5 12 25 12 20 V13.5 Z" fill="currentColor" opacity="0.92" />
      <path d="M16.5 20 L19 22.5 L23.8 17.5" fill="none" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ inverted }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Seal className="text-brass" />
      <div className="leading-none">
        <div className={cn("font-display text-lg font-semibold tracking-tight", inverted ? "text-ink-foreground" : "text-foreground")}>TrustVault</div>
        <div className={cn("eyebrow mt-1", inverted ? "text-ink-muted" : "text-muted-foreground")}>Document custody</div>
      </div>
    </div>
  );
}

const classStyles: Record<Classification, string> = {
  public: "bg-secondary text-secondary-foreground border-border",
  internal: "bg-verified-soft text-verified border-verified/30",
  confidential: "bg-warning-soft text-warning border-warning/30",
  restricted: "bg-destructive/10 text-destructive border-destructive/30",
};

export function ClassificationTag({ value }: { value: Classification }) {
  return (
    <span className={cn("eyebrow inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-medium", classStyles[value])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}

export function AccessTag({ value }: { value: AccessLevel }) {
  return <span className="eyebrow rounded-sm border border-brass/40 bg-brass-soft px-2 py-0.5 text-foreground">{value}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="eyebrow text-brass">{eyebrow}</div>
        <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, eyebrow, children, className, action }: { title?: string; eyebrow?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-lg border border-border bg-card shadow-ledger", className)}>
      {(title || eyebrow) && (
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            {eyebrow && <div className="eyebrow text-muted-foreground">{eyebrow}</div>}
            {title && <h2 className="text-base font-semibold">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-ledger">
      <div className="eyebrow text-muted-foreground">{label}</div>
      <div className="mt-3 font-display text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Banner reminding reviewers that data is mock and controls are not enforced. */
export function MockNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed border-brass/60 bg-brass-soft/60 px-4 py-2.5 text-xs text-foreground">
      <span className="eyebrow mt-0.5 shrink-0 rounded-sm bg-brass px-1.5 py-0.5 text-ink">Mock</span>
      <span>{children ?? "Preview data only. Not connected to the TrustVault backend — no security controls on this page are active yet."}</span>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="eyebrow text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-brass focus:ring-2 focus:ring-ring/30";
