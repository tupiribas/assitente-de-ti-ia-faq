// tailwind.config.js
import typography from '@tailwindcss/typography';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            h1: {
              fontSize: theme('fontSize.4xl') + ' !important',
              fontWeight: theme('fontWeight.bold') + ' !important',
              marginTop: theme('spacing.8') + ' !important',
              marginBottom: theme('spacing.4') + ' !important',
            },
            h2: {
              fontSize: theme('fontSize.3xl') + ' !important',
              fontWeight: theme('fontWeight.semibold') + ' !important',
              marginTop: theme('spacing.7') + ' !important',
              marginBottom: theme('spacing.3') + ' !important',
            },
            h3: {
              fontSize: theme('fontSize.2xl') + ' !important',
              fontWeight: theme('fontWeight.medium') + ' !important',
              marginTop: theme('spacing.6') + ' !important',
              marginBottom: theme('spacing.2') + ' !important',
            },
            a: {
              color: theme('colors.blue.700') + ' !important', // Azul para links
              textDecoration: 'none !important',
              '&:hover': {
                color: theme('colors.blue.900') + ' !important',
                textDecoration: 'underline !important',
              },
            },
            // Adicione estilos para a classe do card de anexo se não estiverem funcionando
            '.faq-document-card a': { // Estilos para links dentro do card
              color: theme('colors.blue.700') + ' !important',
              textDecoration: 'none !important',
            },
            '.faq-document-card a:hover': {
              textDecoration: 'underline !important',
            }
          },
        },
      }),
    },
  },
  plugins: [typography],
};