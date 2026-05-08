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
      },
    },
  ],
};
