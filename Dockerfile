# Dockerfile para o backend Node.js e frontend React (Full-Stack)

# --- FASE 1: Construção do Frontend (React) ---
FROM node:20-alpine AS frontend_build
WORKDIR /app/frontend_source

# Remova a linha `ARG GEMINI_API_KEY` daqui (se estiver em FASE 1)
# A variável será injetada como ENV pelo Fly.io antes do build

COPY package*.json ./
RUN npm install
COPY . .

# Use a variável de ambiente GEMINI_API_KEY que será injetada como segredo
# Certifique-se de que o Vite a pegue durante o build
RUN npm run build


# --- FASE 2: Construção do Backend e Serviço dos Arquivos Estáticos ---
FROM node:20-alpine
WORKDIR /app

# Copia os arquivos package.json e package-lock.json do backend
COPY server/package*.json ./server/
# Instala as dependências do backend
WORKDIR /app/server
RUN npm install
WORKDIR /app

# Copia o restante do código do backend
COPY server/. ./server/

# Copia o arquivo constants.ts para o diretório do backend (server/)
COPY constants.ts ./server/constants.js

# Copia os arquivos construídos do frontend da fase anterior
COPY --from=frontend_build /app/frontend_source/dist ./public

# Expõe a porta em que o backend estará ouvindo
EXPOSE 3001

# Comando para iniciar o servidor Node.js
CMD ["node", "server/index.js"]