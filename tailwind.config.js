/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        celadon: {
          50:  '#f4f9f7',
          100: '#EAF4F0',
          200: '#C8E2D9',
          300: '#ABCDC0',
          400: '#93C4B4',
          500: '#8FBDA9',
          600: '#7BAF9E',
          700: '#69a090',
          800: '#5a9282',
          900: '#3d6e60',
        },
        taupe: {
          DEFAULT: '#A89880',
          light:   '#CFC3B0',
          dark:    '#8A7D68',
        },
      },
    },
  },
  plugins: [],
};
