FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN npm install -g corepack@latest

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN corepack pnpm install --frozen-lockfile

COPY . .
RUN corepack pnpm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g corepack@latest

COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/scripts ./scripts

EXPOSE 3000
CMD ["node", "dist/index.js"]
