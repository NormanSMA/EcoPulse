import type { Config } from "tailwindcss";
import { colors, spacing, radius, motion } from "./src/design-system/tokens";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Alias legacy (globals.css sigue definiendo estas 2 variables,
        // ahora apuntando a --ds-bg-canvas/--ds-text-primary de theme.css).
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Tokens con tema (light/dark vía [data-theme] en <html>, ver
        // design-system/theme/theme.css + design-system/hooks/useTheme.ts).
        "ds-canvas": "var(--ds-bg-canvas)",
        "ds-surface": "var(--ds-bg-surface)",
        "ds-surface-elevated": "var(--ds-bg-surface-elevated)",
        "ds-border": "var(--ds-border-subtle)",
        "ds-text": {
          primary: "var(--ds-text-primary)",
          secondary: "var(--ds-text-secondary)",
          muted: "var(--ds-text-muted)",
        },

        // Marca y estado: independientes del tema, no van en theme.css.
        brand: colors.brand,
        "ds-status": colors.status,
      },
      spacing: {
        "ds-1": spacing[1],
        "ds-2": spacing[2],
        "ds-3": spacing[3],
        "ds-4": spacing[4],
        "ds-5": spacing[5],
        "ds-6": spacing[6],
        "ds-7": spacing[7],
        "ds-8": spacing[8],
        "ds-9": spacing[9],
        "ds-10": spacing[10],
      },
      borderRadius: {
        "ds-sm": radius.sm,
        "ds-md": radius.md,
        "ds-lg": radius.lg,
        "ds-xl": radius.xl,
        "ds-2xl": radius["2xl"],
        "ds-3xl": radius["3xl"],
        "ds-full": radius.full,
        "ds-control": "var(--ds-radius-control)",
        "ds-panel": "var(--ds-radius-panel)",
      },
      transitionDuration: {
        "ds-fast": motion.duration.fast,
        "ds-base": motion.duration.base,
        "ds-slow": motion.duration.slow,
      },
      transitionTimingFunction: {
        "ds-standard": motion.easing.standard,
        "ds-out": motion.easing.out,
      },
    },
  },
  plugins: [],
} satisfies Config;
