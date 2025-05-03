# Use a base image with Node.js (Debian-based for easier dependency management)
FROM node:20-bookworm AS base

# Install Puppeteer dependencies
# Ref: https://pptr.dev/troubleshooting#running-puppeteer-in-docker
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# --- Builder Stage ---
FROM base AS builder

WORKDIR /app
COPY package*.json ./
# Install all dependencies, including devDependencies for build
RUN npm install --verbose
COPY . .
RUN npm run build

# --- Production Stage ---
FROM base AS production

ENV NODE_ENV=production \
    # Skip downloading Chromium during npm install if needed (Puppeteer will download on first launch)
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    # Set a cache directory for Puppeteer downloads inside the container
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Create non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Install only production Node dependencies
# Puppeteer is needed in production
RUN npm ci --only=production --ignore-scripts || npm install --only=production --ignore-scripts

# Create cache directory and set ownership
RUN mkdir -p ${PUPPETEER_CACHE_DIR} && chown -R appuser:appgroup /app

USER appuser

# Puppeteer might download Chromium on first run, ensure the user can write to the cache dir
# The download path can be configured via environment variables if needed.

EXPOSE 11235

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:11235/health || exit 1

CMD [ "node", "dist/index.js" ]