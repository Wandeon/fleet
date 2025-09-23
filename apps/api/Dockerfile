# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/openapi.local.yaml ./openapi.local.yaml
COPY --from=build /app/healthcheck.js ./healthcheck.js
EXPOSE 3015
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node healthcheck.js
CMD ["node", "dist/index.js"]
