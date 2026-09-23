import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "@" can't be a literal App Router segment — it marks a parallel-route slot.
  // Profile URLs are /@handle; the real page lives at /u/[handle].
  async rewrites() {
    return [{ source: "/@:handle", destination: "/u/:handle" }];
  },
};

export default nextConfig;
