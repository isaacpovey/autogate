/** @type {import('next').NextConfig} */
const nextConfig = {
  // `@autogate/api` ships TypeScript source (no build step), so Next must
  // transpile it. We only ever import the `AppRouter` *type* from it, but the
  // module graph still needs to resolve.
  transpilePackages: ["@autogate/api", "@autogate/contracts"],
};

export default nextConfig;
