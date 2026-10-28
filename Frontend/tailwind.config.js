/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#F6F7F5',
          100: '#EDF2F0',
          200: '#E1E6E3',
          300: '#CCD4D0',
          400: '#98A49F',
          500: '#68736F',
          600: '#53605B',
          700: '#3D4944',
          800: '#293632',
          900: '#24312C',
          950: '#18231F',
        },
        sky: {
          50: '#EFF5F3',
          100: '#E2ECE8',
          200: '#CFDED8',
          300: '#AAC3BA',
          400: '#80A69B',
          500: '#5A887E',
          600: '#47766F',
          700: '#365E58',
          800: '#294943',
          900: '#203A35',
          950: '#122722',
        },
        teal: {
          50: '#EFF5F3',
          100: '#E2ECE8',
          200: '#CFDED8',
          300: '#AAC3BA',
          400: '#80A69B',
          500: '#5A887E',
          600: '#47766F',
          700: '#365E58',
          800: '#294943',
          900: '#203A35',
          950: '#122722',
        },
        primary: {
          50: '#EFF5F3',
          100: '#E2ECE8',
          500: '#5A887E',
          600: '#47766F',
          700: '#365E58',
        },
        clinic: {
          teal: '#47766F',
          blue: '#365E58',
          light: '#F6F7F5',
          dark: '#293632'
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '0.875rem',
        '3xl': '1rem',
      },
    },
  },
  plugins: [],
}
