import type { LabelHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

/** Minimal shadcn/ui-style form label. */
export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  // biome-ignore lint/a11y/noLabelWithoutControl: reusable primitive; callers supply htmlFor/control
  return <label className={cn("text-sm font-medium text-slate-700", className)} {...props} />;
}
