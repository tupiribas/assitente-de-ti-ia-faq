/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Certifique-se de que seus arquivos React/TSX estão incluídos aqui
    "./components/**/*.{js,ts,jsx,tsx}", // Se os componentes estiverem em uma pasta 'components' na raiz
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'), // ADICIONE ESTA LINHA AQUI
  ],
}