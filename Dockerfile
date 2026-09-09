# Las keys ya NO se inyectan en build: server.js las lee del entorno en runtime
# (mismo esquema que course-cover-engine). Configurarlas en Coolify como
# variables de runtime: LITELLM_API_KEY, LITELLM_BASE_URL, SUPABASE_URL,
# SUPABASE_ANON_KEY.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "server.js"]
