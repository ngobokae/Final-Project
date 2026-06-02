import React from "react";
import {
  Select as SelectRoot,
  SelectTrigger as RadixSelectTrigger,
  SelectValue as RadixSelectValue,
  SelectContent as RadixSelectContent,
  SelectPortal,
  SelectViewport,
  SelectItem as RadixSelectItem,
  SelectItemText,
  SelectItemIndicator,
} from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";

export function Select({ value, onValueChange, children, className }) {
  return (
    <SelectRoot value={value || undefined} onValueChange={onValueChange}>
      {children}
    </SelectRoot>
  );
}

export function SelectTrigger({ className, children, ...props }) {
  return (
    <RadixSelectTrigger
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </RadixSelectTrigger>
  );
}

export function SelectValue({ placeholder }) {
  return <RadixSelectValue placeholder={placeholder} />;
}

export function SelectContent({ className, children, ...props }) {
  return (
    <SelectPortal>
      <RadixSelectContent
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
          className
        )}
        position="popper"
        sideOffset={4}
        {...props}
      >
        <SelectViewport className="p-1">{children}</SelectViewport>
      </RadixSelectContent>
    </SelectPortal>
  );
}

export function SelectItem({ value, className, children, ...props }) {
  return (
    <RadixSelectItem
      value={value}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectItemText>{children}</SelectItemText>
      <SelectItemIndicator className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <span className="h-2 w-2 rounded-full bg-primary" />
      </SelectItemIndicator>
    </RadixSelectItem>
  );
}
