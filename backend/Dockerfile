FROM node:lts-alpine

# enable pnpm via corepack and ensure workspace installs work
RUN corepack enable pnpm

WORKDIR /app

# copy root workspace config + backend package file
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY backend/package.json backend/

# install only backend deps (hoisted into root node_modules)
RUN pnpm install --filter ./backend...

# copy entire repo and build backend
COPY . .
RUN pnpm --filter ./backend run build

# OpenShift / arbitrary UID: run non-root; g=u lets assigned user (often gid 0) read /app
RUN chgrp -R 0 /app && chmod -R g=u /app
ENV HOME=/tmp
USER 1001

EXPOSE 4000

# use package manager script to start
CMD ["pnpm", "--filter", "./backend", "start"]