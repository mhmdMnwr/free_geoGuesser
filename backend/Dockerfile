FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig*.json nest-cli.json ./
RUN npm install

COPY src ./src
COPY data ./data
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "dist/main"]
