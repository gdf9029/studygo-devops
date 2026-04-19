# ============================================================
# StudyGo Frontend — Multi-stage Docker build
# Stage 1: Build
# Stage 2: Serve with Nginx
# ============================================================

# --- Stage 1: Build ---
FROM node:18-alpine AS builder

LABEL maintainer="StudyGo Team"
LABEL version="${BUILD_VERSION:-1.0.0}"
LABEL description="StudyGo e-learning platform frontend"

WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Accept build-time env variables
ARG REACT_APP_BASE_URL
ARG REACT_APP_RAZORPAY_KEY
ARG NODE_ENV=production

ENV REACT_APP_BASE_URL=$REACT_APP_BASE_URL
ENV REACT_APP_RAZORPAY_KEY=$REACT_APP_RAZORPAY_KEY
ENV NODE_ENV=$NODE_ENV

# Build the React app
RUN npm run build

# --- Stage 2: Serve with Nginx ---
FROM nginx:1.25-alpine AS production

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Create non-root user for security
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin \
    -G nginx-user -g nginx-user nginx-user

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
