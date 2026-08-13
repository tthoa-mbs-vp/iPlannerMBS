import type { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-700/60 ${className}`} />
  );
}

export function SkeletonCard({
  title = true,
  lines = 3,
  children,
  className = "",
}: {
  title?: boolean;
  lines?: number;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      {title && <Skeleton className="mb-4 h-4 w-1/3" />}
      {children}
      {!children &&
        Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`mb-2 h-3 w-full last:mb-0 ${i % 2 === 1 ? "w-5/6" : ""}`} />
        ))}
    </div>
  );
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <Skeleton className="mb-3 h-3 w-16" />
          <Skeleton className="h-8 w-12" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-3 dark:border-slate-700">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-6">
      <div className="flex gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-6">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={`h-3.5 ${j === 0 ? "w-28" : "w-20"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
