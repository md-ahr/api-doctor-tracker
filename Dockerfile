# Production image for Cloudflare Containers (linux/amd64 on the CI runner).
# Do not set --platform on FROM: the Cloudflare builder rejects a constant platform flag.
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
# Full install so native deps (argon2) compile and the TypeScript build can run.
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
# Drop devDependencies here. A second `npm ci --omit=dev` runs `prepare`
# (lefthook), which is not installed when devDependencies are omitted.
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS run

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--harmony-temporal", "dist/server.js"]
