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
            // Garante que os tamanhos sejam aplicados com !important, se necessário
            // Nota: Usar !important deve ser um último recurso, mas pode ser útil para depuração.
            // Tente sem !important primeiro. Se não funcionar, adicione-o para testar.
            h1: {
              fontSize: theme('fontSize.4xl') + ' !important', // Exemplo com !important
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
            // VVVV INÍCIO DA CORREÇÃO PARA LINKS VVVV
            a: {
              color: theme('colors.orange.600') + ' !important',
              textDecoration: 'none !important', // Remove o sublinhado padrão
              '&:hover': {
                color: theme('colors.orange.800') + ' !important',
                textDecoration: 'underline !important', // Adiciona sublinhado apenas no hover, se desejar
              },
            },
            // ^^^^ FIM DA CORREÇÃO PARA LINKS ^^^^
            ol: {
              paddingLeft: theme('spacing.6') + ' !important',
            },
            ul: {
              paddingLeft: theme('spacing.6') + ' !important',
            },
            li: {
              marginTop: theme('spacing.1') + ' !important',
              marginBottom: theme('spacing.1') + ' !important',
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
};