import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#121419",
        panel: "#1A1D24",
        border: "#2A2F3A",
        text: "#E8EAEF",
        accent: "#FFC81E",
        health: {
          green: "#3ECF8E",
          amber: "#F5A623",
          red: "#F0554E",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
