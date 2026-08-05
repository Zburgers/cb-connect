module.exports = {
  apps: [
    {
      name: 'cb-connect',
      script: 'npm',
      args: 'run start',
      cwd: process.cwd(),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
