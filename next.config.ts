import type { NextConfig } from "next";

/** 모든 응답에 붙는 기본 보안 헤더 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/", headers: securityHeaders }, { source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
