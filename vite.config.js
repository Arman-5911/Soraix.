import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiHandler } from "./server/api.mjs";
try {
  process.loadEnvFile();
} catch {}
const liveApi = {
  name: "soraix-live-api",
  configureServer(server) {
    server.middlewares.use(apiHandler);
  },
  configurePreviewServer(server) {
    server.middlewares.use(apiHandler);
  },
};
// No application environment variables are required in the browser bundle.
// An empty prefix list disables VITE_* exposure (built-in MODE/DEV still work).
export default defineConfig({
  envPrefix: [],
  plugins: [react(), liveApi],
  build: { sourcemap: false },
});
