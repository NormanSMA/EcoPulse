// Fase 3.1: el verde deja de ser el color de marca y pasa a ser
// exclusivamente el color de estado "live" (StatusBadge). La marca ahora es
// `brand` (índigo — ya se usaba como acento en NearbySearch/StatsPanel, así
// que no introduce un color nuevo, solo lo formaliza como marca).
export const colors = {
  slate: {
    300: "#cbd5e1",
    400: "#94a3b8",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },
  emerald: { 400: "#34d399", 500: "#10b981", 600: "#059669" },
  rose: { 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48" },
  amber: { 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706" },
  sky: { 400: "#38bdf8", 500: "#0ea5e9" },
  orange: { 500: "#f97316" },
  indigo: { 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5" },
  cyan: { 400: "#22d3ee" },
  yellow: { 700: "#a16207" },

  // Color de marca, independiente del tema y de los colores de estado.
  brand: {
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
  },

  // Colores de estado — deliberadamente independientes del tema (light/dark)
  // y de la marca. `live` es el único verde que queda en toda la UI.
  status: {
    live: "#10b981",
    recent: "#0ea5e9",
    stale: "#f59e0b",
    danger: "#ef4444",
    unknown: "#6b7280",
  },

  // Tokens de superficie/texto por tema. `useTheme()` alterna
  // `data-theme` en <html> y `theme.css` mapea estos valores a variables
  // CSS reales (--ds-bg-canvas, etc.) consumidas por Tailwind vía
  // `tailwind.config.ts`.
  themes: {
    dark: {
      bgCanvas: "#090d16",
      bgSurface: "rgba(15, 23, 42, 0.9)",
      bgSurfaceElevated: "#1e293b",
      textPrimary: "#f1f5f9",
      textSecondary: "#94a3b8",
      textMuted: "#64748b",
      borderSubtle: "#1e293b",
      shadowSm: "0 1px 2px rgba(0,0,0,0.5)",
    },
    light: {
      bgCanvas: "#f8fafc",
      bgSurface: "#ffffff",
      bgSurfaceElevated: "#f1f5f9",
      textPrimary: "#0f172a",
      textSecondary: "#475569",
      textMuted: "#94a3b8",
      borderSubtle: "#e2e8f0",
      shadowSm: "0 1px 2px rgba(0,0,0,0.05)",
    },
  },
} as const;
