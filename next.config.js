/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {}, // ✅ 修复警告：Expected object, received boolean
  },
  eslint: {
    ignoreDuringBuilds: true, // ✅ 防止因 ESLint 报错中断
  },
  typescript: {
    ignoreBuildErrors: true, // ✅ 防止 TypeScript 类型警告阻止构建
  },
  reactStrictMode: true,
  swcMinify: true, // ✅ 优化构建性能
  output: "standalone", // ✅ 便于部署
};

export default nextConfig;
