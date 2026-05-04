FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/
COPY knexfile.js ./

EXPOSE 3000

CMD ["sh", "-c", "npx knex migrate:latest --env production && node src/index.js"]
