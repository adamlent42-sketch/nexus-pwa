interface Props {
  icon?: React.ReactNode;
  message: string;
}

export function EmptyState({ icon, message }: Props) {
  return (
    <div className="py-6 text-center text-xs text-ink-secondary flex flex-col items-center gap-2">
      {icon && <span className="text-ink-tertiary">{icon}</span>}
      <span>{message}</span>
    </div>
  );
}
