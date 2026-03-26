/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Broadcast-style dark UI palette
        surface: {
          DEFAULT: '#0f1117',
          raised: '#1a1d27',
          border: '#2a2d3a',
        },
        brand: {
          red: '#e53e3e',
          green: '#38a169',
          amber: '#d69e2e',
          blue: '#3182ce',
        },
      },
    },
  },
  plugins: [],
}
