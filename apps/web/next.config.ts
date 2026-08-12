import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@devleague/contracts'],
  poweredByHeader: false
};

export default nextConfig;
