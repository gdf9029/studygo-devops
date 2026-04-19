# ============================================================
# StudyGo Backend — Multi-stage Docker build
# Node.js Express API with MongoDB
# ============================================================

# --- Stage 1: Install dependencies ---
FROM node:18-alpine AS deps

WORKDIR /app

COPY package*.json ./

# Install only production dependencies for final image
RUN npm ci --only=production --legacy-peer-deps

# --- Stage 2: Production Image ---
FROM node:18-alpine AS production

LABEL maintainer="StudyGo Team"
LABEL version="${BUILD_VERSION:-1.0.0}"
LABEL description="StudyGo e-learning platform backend API"

WORKDIR /app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G nodejs -g nodejs nodejs

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Accept build-time env variable
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# Expose API port
EXPOSE 4000

# Health check — hits root endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/ || exit 1

# Start the server
CMD ["node", "index.js"]
