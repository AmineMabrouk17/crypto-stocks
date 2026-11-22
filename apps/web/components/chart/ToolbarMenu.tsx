"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ToolbarMenuItem {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface ToolbarMenuProps {
  items: ToolbarMenuItem[];
  onSelect: (value: string) => void;
  /** Visible content inside the trigger, usually an icon plus the current value. */
  trigger: ReactNode;
  /** Accessible name for the trigger; state the current value here. */
  triggerLabel: string;
  triggerTitle?: string;
  triggerClassName?: string;
  /** Accessible name for the popup list. */
  menuLabel: string;
  /** Current value when the menu is a single-choice (radio) list. */
  selectedValue?: string;
  /** Range menus pick one value; action menus run the chosen command. */
  singleChoice?: boolean;
  align?: "start" | "end";
  showChevron?: boolean;
}

const ITEM_CLASS =
  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-black/5 dark:text-zinc-200 dark:data-[highlighted]:bg-white/10";

const CHECK_CLASS = "flex h-3 w-3 shrink-0 items-center justify-center text-primary";

/** Compact popup menu used by the chart toolbar. Base UI owns focus, aria and Escape handling. */
export function ToolbarMenu({
  items,
  onSelect,
  trigger,
  triggerLabel,
  triggerTitle,
  triggerClassName,
  menuLabel,
  selectedValue,
  singleChoice = false,
  align = "end",
  showChevron = true,
}: ToolbarMenuProps) {
  return (
    <BaseMenu.Root modal={false}>
      <BaseMenu.Trigger
        type="button"
        aria-label={triggerLabel}
        title={triggerTitle ?? triggerLabel}
        className={cn(
          "flex h-8 items-center justify-center gap-1 rounded-xl border border-black/5 bg-black/[0.03] px-2.5 text-zinc-500 transition hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 data-[popup-open]:text-zinc-800 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-zinc-400 dark:hover:text-zinc-200 dark:data-[popup-open]:text-zinc-200",
          triggerClassName,
        )}
      >
        {trigger}
        {showChevron && <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />}
      </BaseMenu.Trigger>

      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={6} align={align} className="z-50">
          <BaseMenu.Popup
            aria-label={menuLabel}
            className="min-w-40 rounded-xl border border-black/10 bg-white/95 p-1 shadow-xl backdrop-blur-xl transition data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 dark:border-white/10 dark:bg-bento-surface/95"
          >
            {singleChoice ? (
              <BaseMenu.RadioGroup value={selectedValue} onValueChange={(value: string) => onSelect(value)}>
                {items.map((item) => (
                  <BaseMenu.RadioItem
                    key={item.value}
                    value={item.value}
                    disabled={item.disabled}
                    closeOnClick
                    className={ITEM_CLASS}
                  >
                    <BaseMenu.RadioItemIndicator className={CHECK_CLASS}>
                      <Check className="h-3 w-3" aria-hidden />
                    </BaseMenu.RadioItemIndicator>
                    <span className="flex-1">{item.label}</span>
                  </BaseMenu.RadioItem>
                ))}
              </BaseMenu.RadioGroup>
            ) : (
              items.map((item) => (
                <BaseMenu.Item
                  key={item.value}
                  disabled={item.disabled}
                  onClick={() => onSelect(item.value)}
                  className={ITEM_CLASS}
                >
                  <span className="flex-1">{item.label}</span>
                  {item.description && (
                    <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      {item.description}
                    </span>
                  )}
                </BaseMenu.Item>
              ))
            )}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
