import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // Official Kumon brand swatches (from corporate Canva brand guide)
        brand: {
          DEFAULT: "#3F5AA8",
          dark: "#2C3F76",
          deep: "#3D346C",
          light: "#E6E9F4"
        },
        tint: {
          alerts: { bg: "#FAE367", fg: "#412402", sub: "#854F0B" },
          notes:  { bg: "#D9F1FC", fg: "#042C53", sub: "#185FA5" },
          pos:    { bg: "#E1F5EE", fg: "#085041", sub: "#0F6E56" },
          purple: { bg: "#EEEDFE", fg: "#3D346C", sub: "#534AB7" },
          staff:  { bg: "#F1EFE8", fg: "#2C2C2A", sub: "#5F5E5A" }
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F7F7F5",
          subtle: "#F1EFE8"
        },
        ink: {
          DEFAULT: "#1A1A1A",
          secondary: "#5F5E5A",
          tertiary: "#888780"
        },
        line: {
          DEFAULT: "rgba(0,0,0,0.12)",
          strong: "rgba(0,0,0,0.2)"
        },
        status: {
          info:    { bg: "#E6E9F4", fg: "#2C3F76" },
          warn:    { bg: "#FAEEDA", fg: "#854F0B" },
          danger:  { bg: "#FCEBEB", fg: "#791F1F" },
          success: { bg: "#EAF3DE", fg: "#27500A" },
          neutral: { bg: "#F1EFE8", fg: "#444441" },
          accent:  { bg: "#EEEDFE", fg: "#3D346C" }
        }
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px"
      },
      fontFamily: {
        sans: ["var(--font-body)", "Arial", "Helvetica Neue", "Helvetica", "sans-serif"],
        display: ["var(--font-display)", "Arial Black", "Helvetica", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
