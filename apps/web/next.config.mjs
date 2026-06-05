/** @type {import('next').NextConfig} */
const nextConfig = {
  // @netra/core is plain Node ESM that reads the seed dataset via fs — keep it external
  // so Next loads it at runtime instead of bundling it for the browser.
  serverExternalPackages: ['@netra/core'],
};

export default nextConfig;
