import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, required, hint, error, children, className }: FieldProps) {
  return (
    <div className={cn("mb-4", className)}>
      <label className="block text-[12px] font-medium text-ink-secondary mb-1.5">
        {label}
        {required && <span className="text-status-danger-fg ml-1">*</span>}
        {hint && <span className="text-ink-tertiary font-normal ml-2">{hint}</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-status-danger-fg mt-1">{error}</p>}
    </div>
  );
}

export const inputBase =
  "w-full px-3 py-2 text-[14px] rounded border border-line bg-surface focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors disabled:opacity-60";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return <input {...props} className={cn(inputBase, props.className)} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return <textarea {...props} className={cn(inputBase, "min-h-[80px] resize-y", props.className)} />;
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>
) {
  return <select {...props} className={cn(inputBase, props.className)} />;
}
