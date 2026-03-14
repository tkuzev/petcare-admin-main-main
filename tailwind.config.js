/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 10px 25px rgba(15, 23, 42, 0.08)",
        soft: "0 6px 16px rgba(15, 23, 42, 0.06)",
      },
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e9ff",
          200: "#b8d6ff",
          300: "#88bbff",
          400: "#4f98ff",
          500: "#1f6fff",
          600: "#1557db",
          700: "#1248b2",
          800: "#123d8f",
          900: "#123472",
        },
        ink: {
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
    },
  },
  plugins: [],
};
