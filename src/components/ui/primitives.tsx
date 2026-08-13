import Link from "next/link";
import { ACM_LABELS, CONDITION_LABELS, acmTone, cn, conditionTone } from "@/lib/utils";

export function Panel({
  children,
  className,
  tight,
}: {
  children: React.ReactNode;
  className?: string;
  tight?: boolean;
}) {
  return <div className={cn(tight ? "panel-tight" : "panel", "rounded-2xl", className)}>{children}</div>;
}

export function Chip({
  tone,
  children,
  className,
}: {
  tone: string;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("chip", `chip-${tone}`, className)}>{children}</span>;
}

export function AcmChip({ value }: { value: string }) {
  return <Chip tone={acmTone(value)}>{ACM_LABELS[value] ?? value}</Chip>;
}

export function ConditionChip({ value }: { value: string }) {
  return <Chip tone={conditionTone(value)}>{CONDITION_LABELS[value] ?? value}</Chip>;
}

export function StatusDot({ tone }: { tone: "ok" | "warn" | "danger" | "muted" }) {
  return <span className={cn("dot", `dot-${tone}`)} />;
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        {kicker && (
          <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
            {kicker}
          </div>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-[28px]">
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  delta,
  series,
  tone,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: string;
  series?: number[];
  tone?: "ok" | "warn" | "danger" | "teal" | "ice";
  href?: string;
}) {
  const inner = (
    <Panel className="kpi p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tracking-tight">{value}</div>
      {hint && (
        <div
          className={cn(
            "mt-1 text-xs",
            tone === "danger" && "text-status-action",
            tone === "warn" && "text-status-attention",
            tone === "ok" && "text-status-current",
            !tone && "text-ink-3"
          )}
        >
          {hint}
        </div>
      )}
      {(delta || series?.length) && <div className="mt-2 flex items-end justify-between gap-2"><span className="text-[11px] text-ink-3">{delta}</span>{series?.length ? <svg aria-label="12 week trend" viewBox="0 0 120 24" className="h-6 w-24 text-teal"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={series.map((value, index) => `${(index / Math.max(1, series.length - 1)) * 120},${22 - (value / Math.max(1, ...series)) * 18}`).join(" ")} /></svg> : null}</div>}
    </Panel>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="font-display text-base font-semibold">{title}</div>
      {body && <p className="mt-1 text-sm text-ink-3">{body}</p>}
    </div>
  );
}

export function Meta({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</div>
      <div className="mt-0.5 text-sm text-ink">{value ?? "—"}</div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-[15px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}
