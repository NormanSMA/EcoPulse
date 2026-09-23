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
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 py-8 text-center", className)}>
      {icon && (
        <div className="mb-1 grid h-12 w-12 place-items-center rounded-ds-full bg-ds-surface-high text-ds-text-secondary">
          <MorphIcon icon={icon} size={22} reducedMotion="user" />
        </div>
      )}
      <p className="text-sm font-medium text-ds-text-primary">{title}</p>
      {description && <p className="max-w-xs text-xs text-ds-text-secondary">{description}</p>}
      {action && (
        <Button variant="tonal" size="sm" onClick={action.onClick} className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
