FROM node:20-alpine AS node-builder

# Set the working directory
WORKDIR /app

# Copy package.json and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy TypeScript source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript code
RUN npm run build

FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Install essential dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    curl \
    build-essential \
    git \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Set up Chrome installation
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libu2f-udev \
    libvulkan1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome for WebDriver support
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get update && apt-get install -y ./google-chrome-stable_current_amd64.deb \
    && rm ./google-chrome-stable_current_amd64.deb \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Copy built JS files from node-builder stage
COPY --from=node-builder /app/dist ./dist
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Create a new non-root user for security
RUN groupadd -r crawler && useradd -r -g crawler -s /bin/false crawler

# Install Crawl4AI directly from GitHub repo
RUN pip install --no-cache-dir git+https://github.com/unclecode/crawl4ai.git

# Install playwright
RUN pip install --no-cache-dir playwright

# Install Playwright browsers
RUN npx playwright install chromium

# Create necessary directories with proper permissions
RUN mkdir -p /tmp/crawl4ai-service /app/data /app/logs \
    && chown -R crawler:crawler /app /tmp/crawl4ai-service

# Switch to non-root user for better security
USER crawler

# Expose service port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]