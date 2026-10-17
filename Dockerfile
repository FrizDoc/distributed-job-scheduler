FROM node:24.18.0-bookworm-slim AS base

# root package.json pins npm 12 via devEngines
RUN npm install -g npm@12.0.2

WORKDIR /app


FROM base AS deps

COPY package.json package-lock.json ./
COPY packages/package.json ./packages/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/redis/package.json ./packages/redis/package.json
COPY packages/validations/package.json ./packages/validations/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/scheduler/package.json ./apps/scheduler/package.json

RUN npm ci


FROM deps AS source

COPY . .
RUN chown -R node:node /app

USER node
ENV NODE_ENV=production


FROM source AS migrate

WORKDIR /app/apps/api
CMD ["npm", "run", "db:push"]


FROM source AS api

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "--import", "tsx", "server.ts"]


FROM source AS scheduler

WORKDIR /app/apps/scheduler
CMD ["node", "--import", "tsx", "src/app.ts"]
