import { ReactNode, useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Click/tap-activated explainer (replaces hover tooltips).
 * Opens on tap, closes on second tap or outside click.
 * Large touch target (min 32px) and collision-aware positioning for mobile.
 */
export function InfoPopover({
  label,
  children,
  side = "top",
  align = "center",
  contentClassName,
  triggerClassName,
  iconClassName,
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  contentClassName?: string;
  triggerClassName?: string;
  iconClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex min-h-8 min-w-8 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            triggerClassName,
          )}
        >
          <Info className={cn("h-3.5 w-3.5", iconClassName)} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        collisionPadding={12}
        onClick={(e) => e.stopPropagation()}
        className={cn("w-auto max-w-[min(320px,calc(100vw-24px))] text-xs leading-relaxed", contentClassName)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Click/tap popover wrapped around a custom trigger (e.g. an intensity tag or badge).
 */
export function ClickHint({
  trigger,
  children,
  side = "top",
  align = "center",
  contentClassName,
}: {
  trigger: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  contentClassName?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        collisionPadding={12}
        className={cn("w-auto max-w-[min(320px,calc(100vw-24px))] text-xs leading-relaxed", contentClassName)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
