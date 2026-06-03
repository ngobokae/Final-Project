import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { cn } from "../../utils/cn";

/**
 * A Card with a standardized header (icon + title + description + optional
 * action). Replaces the repeated "Card > CardHeader with border-b > title row"
 * boilerplate and stops pages from fighting the Card primitive with
 * `border-0 shadow-lg` overrides on every instance.
 */
export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  noPadding = false,
  className,
  contentClassName,
}) {
  return (
    <Card className={cn("border-0 shadow-md", className)}>
      {title || action ? (
        <CardHeader className="border-b border-gray-100 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                {Icon ? <Icon className="h-5 w-5 shrink-0 text-primary" /> : null}
                <span className="truncate">{title}</span>
              </CardTitle>
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={cn(noPadding ? "p-0" : "p-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
