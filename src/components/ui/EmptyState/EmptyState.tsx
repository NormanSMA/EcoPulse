import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";
import { Button } from "@/components/ui/Button";

export interface EmptyStateProps {
  icon?: IconNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-2 py-8 px-4 text-ds-text-secondary",
        className
      )}
    >
      {icon && (
        <div className="h-10 w-10 rounded-full bg-ds-surface-elevated flex items-center justify-center text-ds-text-muted mb-1">
          <MorphIcon icon={icon} size={20} reducedMotion="user" />
        </div>
      )}
      <p className="text-sm font-semibold text-ds-text-primary">{title}</p>
      {description && <p className="text-xs text-ds-text-secondary max-w-xs">{description}</p>}
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
