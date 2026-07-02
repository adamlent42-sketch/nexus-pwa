"use client";

import { AlertCircle, RotateCw } from "lucide-react";

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="py-3 px-3 text-xs bg-status-danger-bg text-status-danger-fg rounded flex items-start gap-2">
      <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="leading-snug">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1.5 inline-flex items-center gap-1 text-status-danger-fg underline-offset-2 hover:underline"
          >
            <RotateCw className="w-3 h-3" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
