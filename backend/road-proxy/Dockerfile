FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig*.json nest-cli.json ./
RUN npm ci --prefer-offline || npm install --fetch-retries=5

COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline || npm install --omit=dev --fetch-retries=5
COPY --from=builder /app/dist ./dist

EXPOSE 5003
ENV NODE_ENV=production
ENV PORT=5003

CMD ["node", "dist/main"]
