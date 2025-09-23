# syntax=docker/dockerfile:1.6
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM node:18-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/openapi.local.yaml ./openapi.local.yaml
COPY --from=builder /app/healthcheck.js ./healthcheck.js
EXPOSE 3015
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node healthcheck.js
CMD ["node", "dist/index.js"]
