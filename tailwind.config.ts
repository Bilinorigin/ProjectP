import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        tactical: {
          bg: "#0B0F0E",
          panel: "#141A18",
          edge: "#1F2826",
          olive: "#3F4A2A",
          oliveLight: "#5A6B36",
          slate: "#2A3439",
          slateLight: "#465763",
          accent: "#9CB071",
          warn: "#C9A227",
          danger: "#7A1F1F",
          text: "#D6DCD2",
          muted: "#7C8378",
        },
      },
      fontFamily: {
        stencil: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        tactical: "0 0 0 1px rgba(156,176,113,0.15), 0 8px 30px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
