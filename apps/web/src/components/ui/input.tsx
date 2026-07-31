import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

/** Minimal shadcn/ui-style text input. */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
