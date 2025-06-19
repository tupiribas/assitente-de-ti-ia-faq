// assistente-de-ti/vite.config.ts (Corrigido)
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      server: {
        proxy: {
          '/api': { // Qualquer requisição que comece com /api
            target: 'http://localhost:3001', // Redireciona para o seu backend local
            changeOrigin: true, 
          }
        }
      }
    };
});