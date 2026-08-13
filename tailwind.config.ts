import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0c1320", 2: "#33415a", 3: "#6a7586", 4: "#8a94a3" },
        paper: { DEFAULT: "#f1f5fa", 2: "#f4f7fb" },
        teal: { DEFAULT: "#0b857f", dim: "#0a5f5b", soft: "#e6f6f5" },
        status: { current: "#157347", attention: "#9a5808", action: "#b42318" },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: { glow: "0 0 0 3px rgba(12, 138, 132, 0.16)" },
    },
  },
  plugins: [],
} satisfies Config;
