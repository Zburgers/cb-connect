const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Convex handles API routes via their own server
  // No additional config needed for basic setup
  
  // Enable CORS headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  
  // Exclude e2e directory from Next.js compilation
  webpack: (config) => {
    // Exclude e2e directory from being processed
    config.module.rules.forEach((rule) => {
      if (rule.test && rule.test.toString().includes('tsx?')) {
        rule.exclude = [
          ...(rule.exclude || []),
          path.resolve(__dirname, 'e2e'),
        ];
      }
    });
    return config;
  },
};

module.exports = nextConfig;
