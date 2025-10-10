# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
WORKDIR /app
ENV PRISMA_CLI_BINARY_TARGETS="linux-musl-arm64-openssl-3.0.x"

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run db:generate
RUN npm run build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PRISMA_CLI_BINARY_TARGETS="linux-musl-arm64-openssl-3.0.x"
WORKDIR /app
RUN apk add --no-cache docker-cli
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN rm -f node_modules/.prisma/client/query-engine-linux-musl-arm64-openssl-1.1.x
RUN npm run db:generate
COPY --from=build /app/dist ./dist
COPY --from=build /app/openapi.yaml ./openapi.yaml
COPY --from=build /app/healthcheck.js ./healthcheck.js
EXPOSE 3015
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node healthcheck.js
CMD ["node", "dist/index.js"]
