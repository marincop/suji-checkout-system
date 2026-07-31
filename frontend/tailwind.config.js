/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sushi: {
          bg: '#2E5D3C',
          dark: '#1e3e27',
          light: '#3d7a4f',
          accent: '#FFD700',
        }
      }
    },
  },
  plugins: [],
}
