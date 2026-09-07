import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";

export interface SearchInputProps {
  placeholder?: string;
  shortcutHint?: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  className?: string;
}

/**
 * Barra de búsqueda con debounce y atajo Ctrl+K (Cmd+K en mac) para
 * enfocarla desde cualquier parte de la página, al estilo Vexto.
 */
export function SearchInput({
  placeholder,
  shortcutHint = "Ctrl+K",
  onChange,
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    const handle = setTimeout(() => onChange(value), debounceMs);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (isShortcut) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-ds-xl border border-ds-border bg-ds-surface-elevated px-3 py-2 text-sm text-ds-text-primary focus-within:ring-2 focus-within:ring-brand-500",
        className
      )}
    >
      <MorphIcon icon={Search} size={16} reducedMotion="user" className="text-ds-text-muted shrink-0" />
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none placeholder:text-ds-text-muted min-w-0"
      />
      {shortcutHint && (
        <kbd className="hidden sm:inline-block shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-md border border-ds-border text-ds-text-muted">
          {shortcutHint}
        </kbd>
      )}
    </div>
  );
}
