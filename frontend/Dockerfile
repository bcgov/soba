# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine AS base

# enable pnpm globally
RUN corepack enable pnpm

# Install dependencies only when needed
FROM base AS deps
# need libc6-compat for some packages on alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY frontend/package.json frontend/

# install frontend dependencies through workspace
RUN pnpm install --filter ./frontend... --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules

COPY frontend ./frontend

# Next.js telemetry note
# ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/frontend
# Run build from frontend dir so .next (and .next/standalone) is created here
RUN pnpm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# copy the static public folder from the frontend build
COPY --from=builder /app/frontend/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
# static assets already live within the standalone build

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]