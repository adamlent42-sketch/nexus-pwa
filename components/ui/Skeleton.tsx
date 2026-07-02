import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  rows?: number;
}

export function Skeleton({ className, rows = 3 }: Props) {
  return (
    <div className={cn("py-1", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-3 my-2.5 rounded bg-line animate-pulse"
          style={{ width: `${80 - i * 12}%` }}
        />
      ))}
    </div>
  );
}
