import type { NextConfig } from 'next';
import { join } from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Required for standalone in monorepo: trace deps from workspace root
  outputFileTracingRoot: join(__dirname, '..'),
  turbopack: {
    // root needs to point to workspace root so Next.js can locate hoisted
    // dependencies (like `next`) during a filtered install.
    root: join(__dirname, '..'),
  },
};

export default nextConfig;
