# Build custom server não é compatível com o modo "standalone" do Next.js
# (ver node_modules/next/dist/docs/01-app/02-guides/custom-server.md), então
# a imagem final carrega node_modules de produção "na mão" em vez de copiar
# um bundle standalone.

FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY server.js ./server.js

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
