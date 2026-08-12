import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@devleague/contracts'],
  poweredByHeader: false,
  headers: () => Promise.resolve([{
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }
      ]
    }])
};

export default nextConfig;
