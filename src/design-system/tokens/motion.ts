// Duraciones/easings Material 3 (standard + emphasized) y presets de spring
// que puede consumir `morphicons` (MorphIcon `spring` prop).
export const motion = {
  duration: {
    fast: "150ms",
    base: "200ms",
    slow: "300ms",
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    out: "cubic-bezier(0.05, 0.7, 0.1, 1)",
  },
  spring: {
    smooth: "smooth",
    snappy: "snappy",
    bouncy: "bouncy",
  },
} as const;
