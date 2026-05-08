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
        NODE_ENV: 'production',
        PORT: 6050,
        NEXT_PUBLIC_CONVEX_URL: "https://hallowed-hummingbird-284.convex.cloud",
        NEXT_PUBLIC_CONVEX_SITE_URL: "https://hallowed-hummingbird-284.convex.site",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsuY2IubmFrc2hhdHJhbmV1cmF0ZWNoLmRldiQ",
        CONVEX_DEPLOYMENT: "",
        CLERK_SECRET_KEY: "",
        CLERK_FRONTEND_API_URL: "https://clerk.cb.nakshatraneuratech.dev",
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
      },
    },
  ],
};