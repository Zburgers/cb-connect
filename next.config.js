/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // The release smoke server is addressed through 127.0.0.1 in CI.
  allowedDevOrigins: ['127.0.0.1'],
};

module.exports = nextConfig;
