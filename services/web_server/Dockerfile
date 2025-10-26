FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache bash curl
COPY package*.json ./
RUN npm ci
COPY . .
RUN chmod +x /app/entrypoint.sh

# ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "index.js"]
