// Duraciones/easings para transiciones CSS (hover, toggle, etc.) y presets
// de spring que puede consumir `morphicons` (MorphIcon `spring` prop).
export const motion = {
  duration: {
    fast: "150ms",
    base: "200ms",
    slow: "300ms",
  },
  easing: {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
  },
  // Presets reales de morphicons (`SPRING_PRESETS`): smooth | snappy | bouncy.
  spring: {
    smooth: "smooth",
    snappy: "snappy",
    bouncy: "bouncy",
  },
} as const;
