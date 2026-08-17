const path = require('node:path');

const releaseDir = process.env.CB_CONNECT_RELEASE_DIR;

module.exports = {
  apps: [
    {
      name: 'cb-connect',
      script: releaseDir ? path.join(releaseDir, 'server.js') : 'npm',
      ...(releaseDir ? {} : { args: 'run start' }),
      cwd: releaseDir || process.cwd(),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
