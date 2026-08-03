# Deployment Guide - CB Connect

## Quick Start (localhost:6050)

### On your server machine:

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd cb-connect

# 2. Install dependencies
npm install --production

# 3. Build the application
npm run build

# 4. Copy .env.production to .env and update with your credentials
cp .env.production .env
# Edit .env with your actual Convex and Clerk credentials

# 5. Start the server on port 6050
npm run serve
# OR
PORT=6050 npm run start
```

The app will be available at: **http://localhost:6050**

---

## Production Deployment with PM2

### Setup PM2 (recommended for production):

```bash
# Install PM2 globally
npm install -g pm2

# Update pm2.config.js with correct paths
# Then start the app
pm2 start pm2.config.js

# Save the process list
pm2 save

# Enable startup on boot
pm2 startup
pm2 save
```

### PM2 Commands:

```bash
# View app status
pm2 list

# View logs
pm2 logs cb-connect

# Restart app
pm2 restart cb-connect

# Stop app
pm2 stop cb-connect

# Delete app
pm2 delete cb-connect
```

---

## Environment Variables

Create a `.env` file in the root directory with the following:

```env
# Server Configuration
PORT=6050
NODE_ENV=production

# Convex Backend (Production)
CONVEX_DEPLOYMENT=prod:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site

# Clerk Authentication (Production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your-key
CLERK_SECRET_KEY=sk_live_your-key
CLERK_FRONTEND_API_URL=https://your-clerk-frontend-api-domain
# Optional: only when a Clerk Dashboard webhook endpoint exists.
# CLERK_WEBHOOK_SECRET=whsec_your-svix-secret

# Required comma-separated production origin allowlist.
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:6050

# Clerk Paths
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Convex runtime secret (set in the Convex deployment environment, not PM2).
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook
```

---

## CI/CD with GitHub Actions

The `main` deployment workflow targets a GitHub environment named `production`. Protect that environment and make the listed Actions secrets available at repository or environment scope. The workflow does not copy `.env` files into the repository or write secrets into `pm2.config.js`.

Required frontend deployment secrets:

1. `CONVEX_DEPLOYMENT` - explicit Convex deployment selector
2. `NEXT_PUBLIC_CONVEX_URL` - Convex production client URL
3. `NEXT_PUBLIC_CONVEX_SITE_URL` - Convex HTTP actions URL
4. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
5. `CLERK_SECRET_KEY` - Clerk server secret
6. `CLERK_FRONTEND_API_URL` - Clerk issuer/frontend API URL
7. `CORS_ALLOWED_ORIGINS` - comma-separated production origin allowlist

Convex promotion is disabled by default. To deploy functions in the same workflow, first replace `CONVEX_DEPLOY_KEY` with a valid production deploy key, then set the Actions variable `DEPLOY_CONVEX=true`. Leave the variable absent/false for a frontend-only recovery deployment; an invalid key must not block PM2 recovery.

Optional production environment secret:

- `DISCORD_WEBHOOK_URL` - Convex notification destination when Discord notifications are enabled
- `CLERK_WEBHOOK_SECRET` - Clerk/Svix signing secret, only when a Clerk Dashboard webhook endpoint is configured

### Workflow:

The workflow validates required values without printing them, runs unit tests, builds with the `NEXT_PUBLIC_*` values, then starts or reloads PM2 with runtime values supplied by the step environment. With `DEPLOY_CONVEX=true`, it also syncs optional Convex function secrets using a mode-`0600` temporary file and deploys Convex before the frontend build. It never uses `sed` to mutate source and never deletes the healthy PM2 process before reload.

The public values are still deployment configuration: `NEXT_PUBLIC_*` values are embedded into the browser bundle by Next.js, so they must not contain private credentials. `CLERK_SECRET_KEY` and `CONVEX_DEPLOY_KEY` remain secret-backed. The current deployment does not configure a Clerk webhook endpoint, so `CLERK_WEBHOOK_SECRET` is intentionally optional.

---

## CORS Configuration

CORS preflight responses are restricted to `CORS_ALLOWED_ORIGINS`.
Set this to the exact development and production origins that should call API routes cross-origin.
Do not use `*` for this app because Clerk, Convex, and webhook routes can handle sensitive data.

---

## Port Configuration

The app is configured to run on **port 6050**.

To change the port:
1. Update `PORT` in `.env`
2. Update `npm run serve` script in `package.json`
3. Update `pm2.config.js`

---

## Troubleshooting

### "Port already in use"
```bash
# Find and kill the process
lsof -i :6050
kill -9 <PID>
```

### Build errors
```bash
# Clean and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### PM2 not found
```bash
npm install -g pm2
```

---

## Local Development

```bash
# Development mode (port 3000 by default)
npm run dev

# Production-like build
npm run build
npm run start

# Health check after start
curl http://localhost:6050/api/health
```
