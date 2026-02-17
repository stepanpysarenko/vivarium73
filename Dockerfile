FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache bash curl
COPY package*.json ./
RUN npm ci
COPY . .
RUN chmod +x /app/entrypoint.sh

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "index.js"]
