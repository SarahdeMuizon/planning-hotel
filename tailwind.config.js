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
          100: '#E8F2EE',
          200: '#C5DDD4',
          300: '#A8C5B5',
          400: '#8FBDA9',
          500: '#7BAF9E',
          600: '#69a090',
          700: '#5a9282',
          800: '#4a7a6c',
          900: '#2d5e50',
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
