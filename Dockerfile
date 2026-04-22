# syntax=docker/dockerfile:1
# Stage 1: build do frontend (Vite + TypeScript)
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
ENV NODE_ENV=production
RUN npm run build

# Stage 2: API Node + dist do frontend servido em produção (ver src/app.js)
FROM node:22-alpine
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init wget

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY .sequelizerc ./
COPY src ./src
RUN mkdir -p public

COPY --from=frontend-build /app/frontend/dist ./frontend/dist

RUN chown -R node:node /usr/src/app
USER node

EXPOSE 4001

CMD ["dumb-init", "node", "src/index.js"]
