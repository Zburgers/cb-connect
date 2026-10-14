const os = require('node:os');
const path = require('node:path');

const releaseDir = process.env.CB_CONNECT_RELEASE_DIR;
const pm2Home = process.env.PM2_HOME || path.join(os.homedir(), '.pm2');

module.exports = {
  apps: [
    {
      name: 'cb-connect',
      script: releaseDir ? path.join(releaseDir, 'server.js') : 'npm',
      ...(releaseDir ? {} : { args: 'run start' }),
      cwd: releaseDir || process.cwd(),
      instances: 1,
      log_date_format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
      out_file: path.join(pm2Home, 'logs', 'cb-connect-out.log'),
      error_file: path.join(pm2Home, 'logs', 'cb-connect-error.log'),
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
