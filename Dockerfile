FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add python3 make
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
RUN mkdir -p /app/data /app/screenshots
VOLUME /app/data /app/screenshots
EXPOSE 3000
CMD ["npm", "start"]
