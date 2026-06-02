import React from "react";
import { cn } from "../../utils/cn";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border shadow-lg dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-100",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return (
    <div
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 pt-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }) {
  return (
    <h4
      className={cn("text-xl font-semibold leading-none dark:text-neutral-100", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }) {
  return (
    <p
      className={cn("text-sm text-muted-foreground mt-1 dark:text-neutral-400", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }) {
  return (
    <div
      className={cn("px-6 pb-6", className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }) {
  return (
    <div
      className={cn("flex items-center px-6 pb-6", className)}
      {...props}
    />
  );
}
