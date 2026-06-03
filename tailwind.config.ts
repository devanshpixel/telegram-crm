import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#000000",
          raised: "#0a0a0a",
          card: "#111111",
          overlay: "#161616",
          hover: "#1c1c1c",
          active: "#222222",
        },
        accent: {
          DEFAULT: "#8b5cf6",
          muted: "#7c3aed",
          glow: "rgba(139, 92, 246, 0.12)",
        },
        revenue: {
          DEFAULT: "#22c55e",
          muted: "#16a34a",
          glow: "rgba(34, 197, 94, 0.15)",
        },
        telegram: {
          DEFAULT: "#2aabee",
          outgoing: "#2b5278",
          incoming: "#1a1a1a",
        },
        bubble: {
          incoming: "#1a1a1a",
          outgoing: "#2b5278",
        },
        border: {
          DEFAULT: "#1f1f1f",
          subtle: "#141414",
          focus: "#2a2a2a",
        },
        text: {
          primary: "#fafafa",
          secondary: "#a3a3a3",
          muted: "#525252",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        panel: "0 8px 32px rgba(0, 0, 0, 0.6)",
        card: "0 2px 12px rgba(0, 0, 0, 0.4)",
        glow: "0 0 24px rgba(139, 92, 246, 0.08)",
        "glow-green": "0 0 20px rgba(34, 197, 94, 0.12)",
      },
      spacing: {
        18: "4.5rem",
      },
      screens: {
        xs: "480px",
      },
    },
  },
  plugins: [],
};

export default config;
