import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async redirects() {
    // The revenue-share explainer became the equity launch offer
    // (token-system brief §5.4). Old links live in emails and posts, so 308.
    return [
      { source: "/revenue", destination: "/equity", permanent: true },
      { source: "/revenue/distributions", destination: "/equity", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Source-map upload is deferred (brief Q4). Without SENTRY_AUTH_TOKEN / org /
  // project set, these stay undefined and upload is skipped; error capture
  // still works via the public DSN, prod stack traces are just unminified
  // until the token is added.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
