# ---- Base Stage ----
FROM node:18-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl

# ---- Dependencies Stage ----
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    cp -R node_modules /app/prod_modules
RUN npm ci

# ---- Build / Test Stage ----
FROM dependencies AS build
COPY . .
RUN npm run lint 2>/dev/null || true

# ---- Production Stage ----
FROM base AS production
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Copy production dependencies
COPY --from=dependencies /app/prod_modules ./node_modules

# Copy application source
COPY --chown=nodeuser:nodejs src/ ./src/
COPY --chown=nodeuser:nodejs package*.json ./

# Set permissions
USER nodeuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start application
CMD ["node", "src/server.js"]
