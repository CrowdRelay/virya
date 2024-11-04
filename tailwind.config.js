module.exports = {
  content: ["./src/**/*.js", "./src/**/*.jsx", "./src/**/*.ts", "./src/**/*.tsx"],
  theme: {
    extend: {
      zIndex: {
        '-10': '-10',
        '-100': '-100',
      }
    }
  },
  variants: {
    extend: {
      opacity: ['disabled'],
      flex: ['group-hover'],
    }
  },
  plugins: [],
  darkMode: 'media',
}