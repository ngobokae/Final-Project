import React from "react";
import { cn } from "../../utils/cn";

/**
 * Consistent page title block used at the top of every dashboard page.
 * Replaces the per-page bespoke heading markup so typography, spacing and the
 * actions row line up across roles.
 *
 * Props:
 *  - title:       string | node (required)
 *  - description: string | node
 *  - icon:        lucide icon component
 *  - actions:     node rendered on the right (buttons, toggles, etc.)
 */
export function PageHeader({ title, description, icon: Icon, actions, children, className }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-neutral-100 sm:text-3xl">
          {Icon ? <Icon className="h-7 w-7 shrink-0 text-primary" /> : null}
          <span className="truncate">{title}</span>
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">{description}</p>
        ) : null}
      </div>
      {actions || children ? (
        <div className="flex flex-wrap items-center gap-2">{actions || children}</div>
      ) : null}
    </div>
  );
}
