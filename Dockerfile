# ── Build stage ──
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ── Production stage ──
FROM node:22-alpine

WORKDIR /app

# Setting NODE_ENV to production optimizes many libraries
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
# Install only production dependencies
RUN npm install --omit=dev

# Copy compiled JS only
COPY --from=builder /app/dist ./dist

# Copy entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
