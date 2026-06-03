import React from "react";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { Card, CardContent } from "./card";
import { cn } from "../../utils/cn";

/**
 * Standardized KPI / metric card. Every dashboard re-implemented this with a
 * different ad-hoc gradient; this centralizes the look and ties the accent to
 * the semantic token palette (brand / success / warning / info / neutral).
 */
const ACCENTS = {
  brand: { icon: "bg-primary", glow: "from-primary/10 to-primary/[0.03]" },
  success: { icon: "bg-success", glow: "from-success/10 to-success/[0.03]" },
  warning: { icon: "bg-warning", glow: "from-warning/10 to-warning/[0.03]" },
  info: { icon: "bg-info", glow: "from-info/10 to-info/[0.03]" },
  neutral: { icon: "bg-neutral-700", glow: "from-neutral-500/10 to-neutral-500/[0.03]" },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  trend = "neutral",
  change,
  subtitle,
  hint,
  accent = "brand",
  onClick,
  className,
}) {
  const a = ACCENTS[accent] || ACCENTS.brand;
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const interactive = typeof onClick === "function";

  const interactiveProps = interactive
    ? {
        role: "button",
        tabIndex: 0,
        onClick,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(e);
          }
        },
        "aria-label": `${title}: ${value}.${hint ? ` ${hint}` : ""}`,
      }
    : {};

  return (
    <Card
      {...interactiveProps}
      className={cn(
        "group relative overflow-hidden border-0 shadow-md transition-all duration-300",
        interactive &&
          "cursor-pointer hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity group-hover:opacity-90", a.glow)} />
      <CardContent className="relative p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className={cn("rounded-xl p-2.5 shadow-sm", a.icon)}>
            {Icon ? <Icon className="h-5 w-5 text-white" /> : null}
          </div>
          {change ? (
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                trend === "up"
                  ? "bg-success/15 text-success"
                  : trend === "down"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {change}
            </span>
          ) : null}
        </div>
        <p className="text-xs font-medium text-gray-600 dark:text-neutral-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{value}</p>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-neutral-500">{subtitle}</p>
        ) : null}
        {hint && interactive ? (
          <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-primary">
            {hint}
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
