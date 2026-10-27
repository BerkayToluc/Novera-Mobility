# The API as a container, for Google Cloud Run (ADR-12, docs/DEPLOY.md). This file is at the repository root on
# purpose: Cloud Build uses the folder of the Dockerfile as the build context, and the build needs the root's
# lockfile and workspace files. The repository's only container is the API (the web app runs on Vercel).
#   docker build -t novera-api .
# Cloud Run sets PORT (8080) and the API reads it; HOST stays unset so it listens on every interface.
# Nothing secret is in the image: DATABASE_URL, API_ACCESS_KEY and the rest are set on the Cloud Run service.
# Database migrations are not run here (see docs/DEPLOY.md): a cold start must not wait for them or race them.

# ---- build: all dependencies, Prisma client, Nest build, then only what the API needs at run time
FROM node:24-slim AS build
ENV CI=true
RUN corepack enable
WORKDIR /repo
# The lockfile and manifests first, so the install layer is reused until a dependency changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @novera/api...
COPY apps/api apps/api
RUN pnpm --filter @novera/api exec prisma generate && pnpm --filter @novera/api build
# --legacy: the workspace does not use injected packages; the API has no workspace dependencies.
RUN pnpm --filter @novera/api deploy --legacy --prod /out \
    && cp -r apps/api/dist /out/dist

# ---- run: Node and the production dependencies, as a user that is not root
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
COPY --from=build --chown=node:node /out/package.json ./package.json
USER node
EXPOSE 8080
CMD ["node", "dist/main"]
