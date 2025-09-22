# Node.js API Production Dockerfile
FROM node:18-slim

WORKDIR /app

# Install dependencies for native modules and curl for health checks
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3005/metrics || exit 1

# Start the application
CMD ["npm", "start"]