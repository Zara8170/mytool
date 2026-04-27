import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d10",
        panel: "#14181d",
        border: "#23282f",
        text: "#e7eaee",
        muted: "#8a939c",
        accent: "#5eb1ff",
      },
    },
  },
  plugins: [],
};
export default config;
