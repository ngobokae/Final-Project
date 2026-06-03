import React from "react";
import { cn } from "../../utils/cn";

/**
 * Friendly empty / no-data placeholder. Replaces the bare gray "No data" text
 * scattered across the dashboards with an icon, a clear message and an optional
 * call-to-action.
 */
export function EmptyState({ icon: Icon, title, description, action, compact = false, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-12",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-gray-700 dark:text-neutral-200">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-neutral-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
