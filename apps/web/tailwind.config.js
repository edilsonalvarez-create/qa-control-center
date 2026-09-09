/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "Segoe UI", "sans-serif"],
        display: ["IBM Plex Sans", "sans-serif"],
      },
      colors: {
        ink: {
          950: "#070b14",
          900: "#0c1220",
          800: "#121a2b",
        },
      },
    },
  },
  plugins: [],
};
