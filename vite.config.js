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
export default defineConfig({ plugins: [react(), liveApi] });
