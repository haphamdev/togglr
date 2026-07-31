import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />;
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("text-slate-500", className)} {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-slate-100", className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("border-b border-slate-200 px-3 py-2 font-medium", className)} {...props} />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2 text-slate-700", className)} {...props} />;
}
