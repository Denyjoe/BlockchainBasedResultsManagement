/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebefff',
          200: '#dce3ff',
          300: '#c2ceff',
          400: '#9cb0ff',
          500: '#6d88ff',
          600: '#475eff',
          700: '#3548e6',
          800: '#2b3abd',
          900: '#283499',
        }
      }
    },
  },
  plugins: [],
}
