FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ ./src/
COPY public/ ./public/
COPY next.config.mjs postcss.config.mjs jsconfig.json components.json ./

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/out ./out

EXPOSE 3001

CMD ["serve", "out", "-l", "3001", "-s"]
