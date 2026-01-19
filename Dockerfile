FROM node:20-alpine

# Install dependencies for native modules (bcrypt, better-sqlite3)
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /app/data

ENV NODE_ENV=development
ENV DATABASE_URL=/app/data/accounting.db
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
