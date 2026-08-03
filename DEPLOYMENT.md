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
CLERK_FRONTEND_API_URL=http://localhost:6050
CLERK_WEBHOOK_SECRET=whsec_your-svix-secret

# Optional comma-separated list for preflight requests.
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:6050

# Clerk Paths
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

---

## CI/CD with GitHub Actions

### Required Secrets in GitHub:

1. `SSH_PRIVATE_KEY` - Your server's SSH private key
2. `SSH_USER` - SSH username (e.g., `root` or `ubuntu`)
3. `SSH_HOST` - Server IP or hostname
4. `KNOWN_HOSTS` - Server's SSH fingerprint
5. `NEXT_PUBLIC_CONVEX_URL` - Your Convex production URL
6. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
7. `CLERK_SECRET_KEY` - Clerk secret key
8. `CONVEX_DEPLOY_KEY` - Convex production deploy key
9. `NEXT_PUBLIC_CONVEX_SITE_URL` - Convex HTTP actions URL
10. `CLERK_FRONTEND_API_URL` - Clerk frontend API domain
11. `CLERK_WEBHOOK_SECRET` - Svix/Clerk webhook signing secret

### Workflow:

1. Push to `main` branch
2. GitHub Actions will:
   - Deploy the Convex backend, including the Clerk webhook HTTP action
   - Run unit tests
   - Build the application
   - Deploy to your server via SSH
   - Restart the PM2 process

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
