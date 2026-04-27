import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // monorepo workspace에서 shared 패키지를 transpile
  transpilePackages: ["@mytool/shared"],
};

export default config;
