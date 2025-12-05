# ===================================
# Stage: base
# Common setup for all stages
# ===================================
FROM superiortech/opencv4nodejs AS base

# Add opencv installation to Node path
ENV NODE_PATH=/usr/lib/node_modules

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        dumb-init \
        curl \
        git && \
    rm -rf /var/lib/apt/lists/*

# Setup pnpm
RUN mkdir -p /opt/pnpm
ENV PNPM_HOME=/opt/pnpm
ENV PATH=$PATH:$PNPM_HOME
RUN npm install --global pnpm@latest

# Set working directory
WORKDIR /usr/src

# Set CA certificate for Hue API
ENV NODE_EXTRA_CA_CERTS=/usr/src/node_modules/hue-sync/signify.pem

# Expose ports
EXPOSE 443 8080 3000 2100/udp

# ===================================
# Stage: dependencies
# Install all dependencies (dev + prod)
# ===================================
FROM base AS dependencies

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies)
RUN pnpm install --frozen-lockfile --ignore-scripts --reporter=silent && \
    rm -rf /usr/src/node_modules/@u4

# ===================================
# Stage: development
# Development environment with hot reload
# ===================================
FROM dependencies AS development

# Copy source code
COPY src ./src
COPY .swcrc tsconfig.json ./

# Development runs with source watching
CMD ["pnpm", "run", "dev"]

# ===================================
# Stage: builder
# Type check and build TypeScript
# ===================================
FROM dependencies AS builder

# Copy source and config files
COPY src ./src
COPY .swcrc tsconfig.json ./

# Run type checking and build
RUN pnpm run build

# ===================================
# Stage: production
# Minimal production runtime
# ===================================
FROM base AS production

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --reporter=silent && \
    rm -rf /usr/src/node_modules/@u4

# Copy built application from builder stage
COPY --from=builder /usr/src/build ./build

# Set production environment
ENV NODE_ENV=production

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "build/index.js"]
