import React from "react";
import { cn } from "../../utils/cn";

/**
 * Low-level shimmering placeholder. Compose these to mirror the shape of the
 * content that is loading so the page does not jump when data arrives.
 * The pulse animation is automatically disabled under prefers-reduced-motion.
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-200/80 dark:bg-neutral-800",
        className,
      )}
      {...props}
    />
  );
}

/** A skeleton shaped like a StatCard, for dashboard metric grids. */
export function SkeletonStatCard({ className }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 dark:border-neutral-700 bg-card p-5 shadow-sm",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="mb-2 h-3 w-20" />
      <Skeleton className="mb-2 h-7 w-24" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

/** A skeleton shaped like a chart/section card. */
export function SkeletonCard({ className, lines = 0 }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 dark:border-neutral-700 bg-card p-6 shadow-sm",
        className,
      )}
    >
      <Skeleton className="mb-2 h-5 w-40" />
      <Skeleton className="mb-6 h-3 w-56" />
      <Skeleton className="h-48 w-full rounded-lg" />
      {lines > 0 && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}
