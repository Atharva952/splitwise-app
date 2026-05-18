/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],

  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Cabinet Grotesk", "DM Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },

      colors: {
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },

        surface: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },

      boxShadow: {
        soft: "0 4px 20px rgba(0,0,0,0.06)",
        glow: "0 0 30px rgba(20,184,166,0.25)",
      },

      borderRadius: {
        "4xl": "2rem",
      },

      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg,#14b8a6 0%, #0891b2 100%)",
      },

      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },

      animation: {
        float: "float 3s ease-in-out infinite",
      },
    },
  },

  plugins: [],
};