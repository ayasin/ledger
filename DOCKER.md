# Docker Deployment Guide

This guide explains how to build and run the accounting application using Docker.

## Prerequisites

- Docker installed (version 20.10+)
- Docker Compose installed (version 2.0+)

## Quick Start with Docker Compose

1. **Set environment variables** (optional):
   ```bash
   export JWT_SECRET="your-secure-secret-key-min-32-chars"
   export LOG_LEVEL="info"
   ```

2. **Start the application**:
   ```bash
   docker-compose up -d
   ```

3. **View logs**:
   ```bash
   docker-compose logs -f
   ```

4. **Stop the application**:
   ```bash
   docker-compose down
   ```

The application will be available at `http://localhost:3000`

## Manual Docker Build and Run

### Build the Image

```bash
docker build -t ledger-app .
```

### Run the Container

```bash
# Create a data directory for the database
mkdir -p ./data

# Run the container
docker run -d \
  --name ledger-app \
  -p 3000:3000 \
  -e JWT_SECRET="your-secure-secret-key-min-32-chars" \
  -e NODE_ENV=production \
  -v $(pwd)/data:/app/data \
  ledger-app
```

### Manage the Container

```bash
# View logs
docker logs -f ledger-app

# Stop the container
docker stop ledger-app

# Remove the container
docker rm ledger-app

# Restart the container
docker restart ledger-app
```

## Database Management

### Running Migrations

Migrations run automatically when the container starts. To run them manually:

```bash
docker exec ledger-app npm run db:migrate
```

### Creating a New User

```bash
docker exec -it ledger-app npm run user-cli add-user
```

### Changing a Password

```bash
docker exec -it ledger-app npm run user-cli change-password
```

### Accessing the Database

The SQLite database is stored in the `./data` directory on your host machine, making it persistent across container restarts.

To access the database directly:

```bash
sqlite3 ./data/accounting.db
```

Or use Drizzle Studio from within the container:

```bash
docker exec -it ledger-app npm run db:studio
```

## Environment Variables

Configure the application using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `DATABASE_URL` | SQLite database path | `/app/data/accounting.db` |
| `JWT_SECRET` | Secret key for JWT tokens (required) | - |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `LOG_LEVEL` | Logging level | `info` |
| `PORT` | Application port | `3000` |

## Volume Mounts

- `/app/data` - Database and file storage (should be mounted as a volume)

## Health Check

The container includes a health check endpoint:

```bash
curl http://localhost:3000/api/health
```

## Troubleshooting

### Container won't start

Check the logs:
```bash
docker logs ledger-app
```

### Database permission issues

Ensure the data directory has proper permissions:
```bash
chmod -R 755 ./data
```

### Port already in use

Change the port mapping:
```bash
docker run -p 8080:3000 ...
```

### Rebuild after code changes

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Production Deployment

For production deployments:

1. **Set a strong JWT secret**:
   ```bash
   JWT_SECRET=$(openssl rand -base64 48)
   ```

2. **Use a reverse proxy** (nginx, Traefik, Caddy) for HTTPS

3. **Set up backup** for the `./data` directory

4. **Configure restart policy**:
   ```yaml
   restart: unless-stopped
   ```

5. **Monitor logs** and set up log rotation

6. **Use Docker secrets** or environment files for sensitive data

## SvelteKit Adapter Note

This project uses `@sveltejs/adapter-auto` which automatically detects the deployment platform. In Docker/Node.js environments, it will use the Node.js adapter.

For more control, you can explicitly install `@sveltejs/adapter-node`:

```bash
npm install -D @sveltejs/adapter-node
```

And update `svelte.config.js`:

```javascript
import adapter from '@sveltejs/adapter-node';
```
