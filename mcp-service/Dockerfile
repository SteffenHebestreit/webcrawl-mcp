FROM node:20-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies including development dependencies for building
RUN npm install

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Create a smaller production image
FROM node:20-alpine AS production

# Set environment variable for production
ENV NODE_ENV=production

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set the working directory
WORKDIR /app

# Copy package.json files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production || npm install --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Set proper permissions
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose the port for MCP connection
EXPOSE 11235

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:11235/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]