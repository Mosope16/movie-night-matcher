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
        ink: "#111827",
        saffron: "#F2B705",
        tomato: "#E8503A",
        mint: "#5CC8A1",
        night: "#17202A"
      },
      boxShadow: {
        deck: "0 18px 45px rgba(17, 24, 39, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
