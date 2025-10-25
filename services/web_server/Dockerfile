FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci
COPY . .

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "index.js"]
