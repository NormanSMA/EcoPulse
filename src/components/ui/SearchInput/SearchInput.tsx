import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { Search, X } from "lucide";
import { MorphIcon } from "morphicons/react";
import { cn } from "@/design-system/utils/cn";

export interface SearchInputProps {
  placeholder?: string;
  shortcutHint?: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Barra de búsqueda pill (search bar Material 3) con debounce, botón de
 * limpiar y atajo Ctrl+K / Cmd+K para enfocarla desde cualquier parte.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { placeholder, shortcutHint = "Ctrl+K", onChange, debounceMs = 300, autoFocus, className },
  ref
) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const id = useId();

  useEffect(() => {
    const handle = setTimeout(() => onChange(value), debounceMs);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, debounceMs]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (isShortcut && inputRef.current?.offsetParent !== null) {
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
        "flex h-11 items-center gap-3 rounded-ds-full bg-ds-surface-high px-4 text-sm text-ds-text-primary",
        "transition-[background-color,box-shadow] duration-ds-fast hover:bg-ds-surface-highest",
        "focus-within:bg-ds-surface-highest focus-within:ring-2 focus-within:ring-ds-primary",
        className
      )}
    >
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <MorphIcon icon={Search} size={18} reducedMotion="user" className="shrink-0 text-ds-text-secondary" />
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue("");
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ds-text-secondary [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="-mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-ds-full text-ds-text-secondary hover:bg-ds-hover hover:text-ds-text-primary"
        >
          <MorphIcon icon={X} size={16} reducedMotion="user" />
        </button>
      ) : (
        shortcutHint && (
          <kbd className="hidden shrink-0 rounded-ds-md border border-ds-outline-variant px-1.5 py-0.5 font-sans text-[11px] text-ds-text-muted sm:inline-block">
            {shortcutHint}
          </kbd>
        )
      )}
    </div>
  );
});
