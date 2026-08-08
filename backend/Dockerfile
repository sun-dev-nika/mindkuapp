# Dockerfile del backend (Express + TypeScript + mysql2, sin ORM).
#
# Multi-stage para que la imagen final no lleve TypeScript ni devDependencies:
#  - "build": instala TODO (incl. dev), compila src/ -> dist/ con tsc.
#  - runtime: solo dependencias de producción + dist/. Corre como el usuario
#    "node" (no root) y arranca igual que `npm start` (node dist/server.js).
#
# Node 24 para ser consistente con CI (.github/workflows/ci.yml usa Node 24).
#
# Uso local (con el MySQL de dev en el host):
#   docker build -t notes-web-backend ./backend
#   docker run --rm -p 3000:3000 \
#     -e NOTES_DB_HOST=host.docker.internal -e NOTES_DB_USER=root \
#     -e NOTES_DB_PASSWORD=... -e NOTES_DB_NAME=notes_web \
#     -e JWT_SECRET=... notes-web-backend
#
# En EC2 las variables llegan como `-e` leídas de SSM Parameter Store por
# docs/aws/userdata.sh — nunca hay un archivo .env dentro de la imagen ni
# en la instancia (.env está además excluido por .dockerignore).

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Healthcheck contra GET /health (endpoint público que hace SELECT 1 a MySQL).
# Se usa fetch de Node en vez de curl porque la imagen slim no trae curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

USER node
CMD ["node", "dist/server.js"]
