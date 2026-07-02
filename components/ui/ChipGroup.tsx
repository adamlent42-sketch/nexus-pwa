"use client";

import { cn } from "@/lib/utils";

interface SingleProps {
  value: string | null;
  onChange: (v: string) => void;
  options: readonly string[];
  multi?: false;
}
interface MultiProps {
  value: string[];
  onChange: (v: string[]) => void;
  options: readonly string[];
  multi: true;
}
type Props = SingleProps | MultiProps;

export function ChipGroup(props: Props) {
  const isSelected = (opt: string) =>
    props.multi ? props.value.includes(opt) : props.value === opt;

  const onClick = (opt: string) => {
    if (props.multi) {
      const next = props.value.includes(opt)
        ? props.value.filter((v) => v !== opt)
        : [...props.value, opt];
      props.onChange(next);
    } else {
      props.onChange(opt);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {props.options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onClick(opt)}
          className={cn(
            "px-3 py-1.5 rounded-full border text-[13px] transition-colors",
            isSelected(opt)
              ? "bg-brand text-white border-brand"
              : "bg-surface border-line hover:bg-surface-muted"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
