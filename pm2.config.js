const requiredRuntimeEnv = [
  'CONVEX_DEPLOYMENT',
  'NEXT_PUBLIC_CONVEX_URL',
  'NEXT_PUBLIC_CONVEX_SITE_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_FRONTEND_API_URL',
  'CORS_ALLOWED_ORIGINS',
];

function readRequiredRuntimeEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required production runtime environment variable: ${name}`);
  }

  return value;
}

const runtimeEnv = Object.fromEntries(
  requiredRuntimeEnv.map((name) => [name, readRequiredRuntimeEnv(name)]),
);

module.exports = {
  apps: [
    {
      name: 'cb-connect',
      script: 'npm',
      args: 'run start',
      cwd: '/home/naki/Desktop/actions-runner/_work/cb-connect/cb-connect',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.PORT || 6050,
        ...runtimeEnv,
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in',
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || '/sign-up',
      },
    },
  ],
};
