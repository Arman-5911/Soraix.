import fs from "node:fs";

// One production policy for Vercel and the standalone server.
const config = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
export const securityHeaders = Object.fromEntries(
  config.headers.find(rule => rule.source === "/(.*)").headers.map(({ key, value }) => [key, value]),
);
export function applySecurityHeaders(res) {
  for (const [key, value] of Object.entries(securityHeaders)) res.setHeader(key, value);
}
