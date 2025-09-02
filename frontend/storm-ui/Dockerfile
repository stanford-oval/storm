# STORM UI Frontend Dockerfile
# Multi-stage build for optimal image size and security

# ============================================================
# Stage 1: Dependencies installation
# ============================================================
FROM node:18-alpine AS deps

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache libc6-compat dumb-init

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies with npm ci for faster, reliable, reproducible builds
RUN if [ -f package-lock.json ]; then npm ci --only=production --ignore-scripts; \
    else echo "Lockfile not found." && exit 1; \
    fi

# ============================================================
# Stage 2: Build stage
# ============================================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set build-time environment variables
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:8000
ARG NODE_ENV=production

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

# Install all dependencies (including devDependencies)
RUN npm ci --ignore-scripts

# Type check
RUN npm run type-check

# Run tests
RUN npm run test:ci

# Build the application
RUN npm run build

# ============================================================
# Stage 3: Development runtime
# ============================================================
FROM node:18-alpine AS development

RUN apk update && apk upgrade && apk add --no-cache dumb-init curl

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set ownership
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start development server
CMD ["dumb-init", "npm", "run", "dev"]

# ============================================================
# Stage 4: Production runtime
# ============================================================
FROM node:18-alpine AS production

# Install security updates and required packages
RUN apk update && apk upgrade && apk add --no-cache dumb-init curl tini

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public

# Set correct permissions for nextjs user
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["dumb-init", "node", "server.js"]

# ============================================================
# Stage 5: Testing stage (for CI/CD)
# ============================================================
FROM node:18-alpine AS test

RUN apk update && apk upgrade && apk add --no-cache dumb-init chromium

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install all dependencies including dev
RUN npm ci --ignore-scripts

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Run all tests
RUN npm run test:ci
RUN npm run type-check
RUN npm run lint

# Default command for test stage
CMD ["npm", "run", "test"]