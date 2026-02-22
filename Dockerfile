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

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy compiled JS
COPY --from=builder /app/dist ./dist

# Copy source for migrations and seed (ts-node needs them)
COPY tsconfig.json ./
COPY src ./src

# Install ts-node and typescript for running migrations
RUN npm install ts-node typescript tsconfig-paths

# Copy entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
