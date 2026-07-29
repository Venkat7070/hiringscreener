import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        amber: {
          DEFAULT: "#F4CC67",
          dark: "#DDAF3C",
        },
        stone: {
          950: "#0c0a09",
        },
      },
    },
  },
  plugins: [],
};

export default config;
