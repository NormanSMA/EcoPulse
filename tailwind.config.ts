import type { Config } from "tailwindcss";
import { spacing, radius, motion } from "./src/design-system/tokens";

// Color con tema: la variable guarda canales RGB (ver theme.css), así las
// utilidades soportan opacidad (`bg-ds-primary/10`).
const v = (name: string) => `rgb(var(--ds-${name}) / <alpha-value>)`;

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--ds-font-sans)"],
        mono: ["var(--ds-font-mono)"],
      },
      colors: {
        "ds-canvas": v("canvas"),
        "ds-surface": {
          DEFAULT: v("surface"),
          container: v("surface-container"),
          high: v("surface-container-high"),
          highest: v("surface-container-highest"),
        },
        "ds-text": {
          primary: v("text-primary"),
          secondary: v("text-secondary"),
          muted: v("text-muted"),
        },
        "ds-outline": {
          DEFAULT: v("outline"),
          variant: v("outline-variant"),
        },
        "ds-primary": {
          DEFAULT: v("primary"),
          on: v("on-primary"),
          container: v("primary-container"),
          "on-container": v("on-primary-container"),
        },
        "ds-secondary": {
          container: v("secondary-container"),
          "on-container": v("on-secondary-container"),
        },
        "ds-highlight": v("highlight"),
        "ds-error": v("error"),
        "ds-success": v("success"),
        "ds-warning": v("warning"),
        "ds-status": {
          live: v("status-live"),
          recent: v("status-recent"),
          stale: v("status-stale"),
          unknown: v("status-unknown"),
        },
      },
      backgroundColor: {
        "ds-panel": "var(--ds-panel)",
        "ds-panel-strong": "var(--ds-panel-strong)",
        "ds-scrim": "var(--ds-scrim)",
        "ds-hover": "var(--ds-state-hover)",
        "ds-press": "var(--ds-state-press)",
      },
      boxShadow: {
        "ds-1": "var(--ds-shadow-1)",
        "ds-2": "var(--ds-shadow-2)",
        "ds-3": "var(--ds-shadow-3)",
      },
      backdropBlur: {
        "ds-panel": "var(--ds-panel-blur)",
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
        "ds-sheet": "var(--ds-radius-sheet)",
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
      keyframes: {
        "ds-sheet-in": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "ds-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "ds-pop-in": {
          from: { opacity: "0", transform: "translateY(4px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "ds-sheet-in": `ds-sheet-in ${motion.duration.slow} ${motion.easing.out}`,
        "ds-fade-in": `ds-fade-in ${motion.duration.base} ${motion.easing.standard}`,
        "ds-pop-in": `ds-pop-in ${motion.duration.base} ${motion.easing.out}`,
      },
    },
  },
  plugins: [],
} satisfies Config;
