FROM node:24-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ai-sdk-playground/gateway build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=127.0.0.1 PORT=8787
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate
COPY --from=build /workspace /app
EXPOSE 8787
USER node
CMD ["pnpm", "--filter", "@ai-sdk-playground/gateway", "start"]
