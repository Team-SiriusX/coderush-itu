FROM node:20-alpine
RUN npm install -g pnpm tsx
WORKDIR /app
COPY docker/engine/package.json ./
RUN pnpm install
COPY . .
CMD ["tsx", "docker/engine/src/index.ts"]
