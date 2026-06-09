FROM node:20-alpine

WORKDIR /app

# bcrypt needs native build tools on Alpine
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

EXPOSE 3001

ENTRYPOINT []
CMD ["npm", "start"]
