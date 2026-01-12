# Multi-stage build for SvelteKit accounting application

# Build stage
FROM node:20-alpine AS builder

# Install build dependencies for native modules (bcrypt, better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies for SQLite
RUN apk add --no-cache sqlite

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
# We still need bcrypt and better-sqlite3 which require build tools
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev && \
    apk del python3 make g++

# Copy built application from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/drizzle ./drizzle

# Copy necessary configuration files
COPY svelte.config.js ./
COPY drizzle.config.ts ./
COPY tsconfig.json ./

# Copy database scripts and migrations
COPY scripts ./scripts

# Copy startup script
COPY start.sh ./start.sh
RUN chmod +x /app/start.sh

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_URL=/app/data/accounting.db
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Use the startup script as entrypoint
CMD ["/app/start.sh"]
