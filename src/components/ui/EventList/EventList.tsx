import type { IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";
import { StatusBadge, type SimpleStatus } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

export interface EventListItem {
  id: string;
  icon: IconNode;
  /** Color de la capa (hex de tokens/colors.ts → layers). */
  color: string;
  title: string;
  description: string;
  timestamp: string;
  status: SimpleStatus;
  selected?: boolean;
  onClick?: () => void;
}

export interface EventListProps {
  items: EventListItem[];
  emptyIcon?: IconNode;
  emptyTitle: string;
  emptyDescription?: string;
  className?: string;
}

/**
 * Lista de eventos recientes (sismos, incendios, desastres…) con estilo de
 * lista Material 3: avatar tonal del color de la capa, título, texto de
 * apoyo y metadatos. Presentacional — recibe los items ya ordenados.
 */
export function EventList({ items, emptyIcon, emptyTitle, emptyDescription, className }: EventListProps) {
  if (items.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} className={className} />;
  }

  return (
    <ul className={cn("flex flex-col gap-0.5 overflow-y-auto overscroll-contain", className)}>
      {items.map((item) => {
        const content = (
          <>
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-ds-full"
              style={{ color: item.color, backgroundColor: `${item.color}24` }}
            >
              <MorphIcon icon={item.icon} size={18} reducedMotion="user" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-ds-text-primary">{item.title}</span>
              <span className="truncate text-xs text-ds-text-secondary">{item.description}</span>
              <span className="mt-1 flex items-center gap-2">
                <StatusBadge status={item.status} size="sm" />
                <span className="truncate text-[11px] tabular-nums text-ds-text-muted">{item.timestamp}</span>
              </span>
            </span>
          </>
        );

        const rowClass = cn(
          "flex w-full items-start gap-3 rounded-ds-control px-3 py-2.5 text-left transition-colors duration-ds-fast",
          item.selected ? "bg-ds-secondary-container/60" : item.onClick && "hover:bg-ds-hover"
        );

        return (
          <li key={item.id}>
            {item.onClick ? (
              <button type="button" onClick={item.onClick} aria-pressed={item.selected} className={rowClass}>
                {content}
              </button>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
